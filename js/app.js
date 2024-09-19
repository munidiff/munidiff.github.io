import axios from "axios";
import "prismjs";
import "prismjs/components/prism-diff";
import "metro4";
import buffer from "buffer";
import config from "./config.js";

const debug = config.debug;

const default_extensions = ['ecore'];

const axiosInstance = axios.create({
    baseURL: 'https://api.github.com'
});

async function setAxiosHeaders() {
    const headers = await getHeaders();
    if (headers.Authorization) {
        axiosInstance.defaults.headers.common['Authorization'] = headers.Authorization;
    }
}

function init() {
    setAxiosHeaders();

    // Parse the URL query parameters
    const queryParams = new URLSearchParams(window.location.search);

    // Check if the 'url' parameter exists
    const urlParam = queryParams.get('url');
    if (urlParam) {
        // Set the 'url' parameter value as the input value
        document.getElementById('urlInput').value = urlParam;
        fetchData();
    }
}

async function getHeaders() {
    // Fetch the token from the backend
    const token = await fetchToken();

    var result = {};
    if (token) {
        // Set the Authorization header
        result = {
            Authorization: `Bearer ${token}`
        };
        if (debug) {console.log('Token: ' + token);}
    }
    else {
        if (debug) {console.log('No token found');}
    }
    return result;
}

async function fetchToken() {
    try {
        const response = await axios.get(config.tokenUrl);
        return response.data; // Assuming the function returns the token directly
    } catch (error) {
        console.error('Error fetching token:', error);
        return null;
    }
}

function showError(message) {
    Metro.notify.create(message, "Error", {
        cls: "alert",
        keepOpen: false,
        width: 300,
        duration: 200,
        timeout: 2000
    });
}

async function fetchData() {
    // extract details from url
    const repo = getRepoDetails($("#urlInput").val());
    if (repo === null) {
        return;
    }

    // list of commits
    axiosInstance.get(getCommitsUrl(repo),
        {
            params: {
                per_page: 100
            }
        }
    ).then(function (response) {
        repo.commits = response.data;

        // display the list of commits
        const container = document.getElementById('commitslist');
        container.innerHTML = '';

        repo.commits.forEach(commit => {

            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div class="card-header">
                    <img src="${getAvatar(commit)}" class="avatar p-1" style="width:32px;height:32px;margin-right:10px"></div>
                <div class="card-content p-2">
                    <p>${getAuthorDetails(commit)} authored on ${formatCommitDate(commit.commit.author.date)}.
                    <a href="${commit.html_url}" target="_blank">${commit.sha.substring(0,7)}</a></p>
                </div>
            `;

            const link = document.createElement('a');
            link.href = '#'; // Prevent default link behavior
            link.textContent = getCommitMessage(commit);

            // Add click event listener with the file name
            link.addEventListener('click', function() {
                showCommitDetails(repo, commit.sha)
            });
            card.children[0].appendChild(link);

            container.appendChild(card);
        });
    }).catch(function (error) {
        switch (error.response.status) {
            case 404:
                showError('404: URL not found');
                return;
            default:
                showError(`${error.response.status}: Error fetching URL details`);
                return;
        }
    });

    // clean previous commit details if any
    document.getElementById('commitDetails').innerHTML = '';
    document.getElementById('modelsList').innerHTML = '';

    if (repo.commit) {
        showCommitDetails(repo, repo.commit);
    }
}

function getAvatar(commit) {
    if (commit.author == null) {
        return "assets/default-gravatar.png";
    }
    return commit.author.avatar_url;
}

function getAuthorDetails(commit) {
    if (commit.author == null) {
        return commit.commit.author.name;
    }
    return `<a href="${commit.author.html_url}" target="_blank">${commit.author.login}</a>`;
}

function getCommitMessage(commit) {
    // if message has an extended description, ommit it
    if (commit.commit.message.includes('\n\n')) {
        return commit.commit.message.split('\n\n')[0];
    }
    return commit.commit.message;
}

function getCommitDescription(commit) {
    if (commit.commit.message.includes('\n\n')) {
        return commit.commit.message.split('\n\n')[1];
    }
    return null;
}

async function showCommitDetails(repo, commit) {

    var response = await axiosInstance.get(getCommitUrl(repo, commit));
    const commitData = response.data;

    const commitDetails = document.getElementById('commitDetails');
    commitDetails.innerHTML = '';

    const header = document.createElement('div');
    header.innerHTML = `
        <h2>${getCommitMessage(commitData)}</h2>
        ${getCommitDescription(commitData) ? `<p>${getCommitDescription(commitData)}</p>` : ''}
        <p><em>Committed by ${getAuthorDetails(commitData)} on ${formatCommitDate(commitData.commit.author.date)}.
        <a href="${commitData.html_url}" target="_blank">${commitData.sha.substring(0,7)}</a></em></p>
        <p>List of changed model files:</p>
    `;
    commitDetails.appendChild(header);

    // load timeline config file from repository
    const timeline = await getTimelineMetadata(repo);
    repo.timeline = timeline;

    // display the list of model files (with the extensions specified in the timeline)
    const changedFiles = commitData.files.map(file => file.filename);

    const list = document.createElement('ul');
    list.className = 'group-list';

    changedFiles.forEach(file => {
        if (!endsWithExtension(file, timeline.model_extensions)) {
            return;
        }

        const listItem = document.createElement('li');
        listItem.className = 'list-group-item';

        // Create an anchor element
        const link = document.createElement('a');
        link.href = '#'; // Prevent default link behavior
        link.textContent = file;
        link.className = "modelFile";
        const linkId = removeNonAlphaNumeric(file);
        link.setAttribute("id", linkId);

        // Add click event listener to call showDiffData with the file name
        link.addEventListener('click', function() {
            showDiffData(repo, file, commit);
        });

        listItem.appendChild(link);

        const dropdown = document.createElement('div');
        dropdown.innerHTML = `<div
            id="dropdown_${linkId}"
            data-role="dropdown"
            data-toggle-element="#${linkId}"
            data-no-close="true">
                <div class="row">
                    <div class="cell-5">
                        <ul data-role="tabs" data-tabs-type="pills" data-expand="true">
                            <li><a href="#munidiff_${linkId}">munidiff</a></li>
                            <li><a href="#diff_${linkId}">diff</a></li>
                        </ul>
                        <div id="munidiff_${linkId}" class="frame p-4" style="display:none">
                            <pre class="line-numbers" style="white-space: pre-wrap;"><code id="munidiffcode_${linkId}" class="language-diff diff-highlight"></code></pre>
                        </div>
                        <div id="diff_${linkId}" class="frame p-4" style="display:none">
                            <pre class="line-numbers" style="white-space: pre-wrap;"><code id="diffcode_${linkId}" class="language-diff diff-highlight"></code></pre>
                        </div>
                    </div>
                    <div id="diagramdiff" class="cell-7">
                        <ul data-role="tabs" data-tabs-type="pills" data-expand="true">
                            <li><a href="#diagramdiff">diagram diff</a></li>
                        </ul>
                        <div id="svgdiff_${linkId}" class="svgdiff">
                        </div>
                    </div>
                </div>
            </div>`;

        listItem.appendChild(dropdown);

        list.appendChild(listItem);
    });

    const modelsList = document.getElementById("modelsList")
    modelsList.innerHTML = '';
    modelsList.appendChild(list);
}

function removeNonAlphaNumeric(str) {
    return str.replace(/[^a-zA-Z0-9]/g, '');
}

const formatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
    hour12: true // Use 12-hour format with AM/PM
});

function formatCommitDate(date) {
    return formatter.format(new Date(date));
}

function endsWithExtension(filename, extensions) {
    for (const extension of extensions) {
        if (filename.endsWith(extension)) {
            return true;
        }
    }
    return false;
}

async function getPreviousCommit(repo, commitSha) {
    return await axiosInstance.get(getCommitUrl(repo, commitSha)).then(
        function (response) {
            var commit = response.data;

            // if the commit has multiple parents (e.g. a merge commit), we
            // use the first one, as it corresponds to the branch where the
            // changes were merged to (such as the main branch)
            if (commit.parents && commit.parents.length >= 1) {
                return commit.parents[0].sha;
            }
            return null;
        }
    );
}

function isValidGitHubRepoUrl(url) {
    const regex = /^https:\/\/github\.com\/[^\/]+\/[^\/]+\/?.*$/;
    return regex.test(url);
}

function getRepoDetails(url) {
    if (!isValidGitHubRepoUrl(url)) {
        showError('Invalid GitHub URL');
        return null;
    }

    // Extract the parts of the URL after 'github.com/'
    const parts = url.split('github.com/')[1].split('/');

    var metadata = {};
    metadata.owner = parts[0];
    metadata.repo = parts[1];

    // if a commit hash is provided in the URL
    if (parts.length >= 4 && parts[2] == 'commit') {
        metadata.commit = parts[3];
    }

    return metadata;
}

async function showDiffData(repo, filename, commit) {

    const linkId = removeNonAlphaNumeric(filename);

    var diffcode = document.getElementById('diffcode_' + linkId);
    if (diffcode.textContent.trim().length > 0) {
        if (debug) {console.log('Request already processed');}
        return;
    }

    var fromModel = null;

    var previousCommit = await getPreviousCommit(repo, commit);
    if (previousCommit !== null) {
        fromModel = await getFileContents(getFileUrl(repo, filename, previousCommit));
    }

    // pass an empty from model when no file exists in the previous commit (i.e. the file is new)
    if (fromModel === null) {
        fromModel = "";
    }

    var toModel = await getFileContents(getFileUrl(repo, filename, commit));

    // load metamodel contents of the current commit
    // FIXME: might have incompatible changes with respect to the previous commit
    var metamodels = [];
    for (const metamodel of repo.timeline.metamodels) {
        var metamodelUrl = getFileUrl(repo, metamodel, commit);
        var metamodelContent = await getFileContents(metamodelUrl);
        metamodels.push(metamodelContent);
    }

    var request = {
        modelName: filename,
        fromModel: fromModel,
        toModel: toModel,
        metamodels: metamodels
    }
    if (debug) {console.log(request);}

    // Send request to Google Cloud Function
    axios.post(getModiffBackendUrl(), request)
        .then(function (response) {
            if (debug) {console.log(response.data);}

            var diffcode = document.getElementById('diffcode_' + linkId);
            diffcode.innerHTML = escapeSpecialChars(response.data["diff"]);
            Prism.highlightElement(diffcode);

            var munidiffcode = document.getElementById('munidiffcode_' + linkId);
            munidiffcode.innerHTML = escapeSpecialChars(response.data["textual-munidiff"]);
            Prism.highlightElement(munidiffcode);

            var diffDiagram = document.getElementById('svgdiff_' + linkId);
            diffDiagram.innerHTML = response.data["graphical-munidiff"]
        })
        .catch(function (error) {
            console.error(error);
        });
}

async function getTimelineMetadata(repo) {
    var url = getTimelineUrl(repo);
    var fileContents = await getFileContents(url);

    var metadata;
    if (fileContents == null) {
        metadata = {
            model_extensions: [],
            metamodels: []
        };
    }
    else {
        metadata = JSON.parse(fileContents);
    }

    // add default extensions if not specified
    for (const extension of default_extensions) {
        if (!metadata.model_extensions.includes(extension)) {
            metadata.model_extensions.push(extension);
        }
    }

    return metadata;
}

async function getFileContents(url) {
    try {
        const response = await axiosInstance.get(url);
        const fileContentBase64 = response.data.content;
        const fileContent = buffer.Buffer.from(fileContentBase64, 'base64').toString('utf-8');

        return fileContent;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            console.error('File not found:', url);
        } else {
            console.error('Error fetching the file:', error);
        }
    }
    return null;
}


function getTimelineUrl(repo) {
    return `/repos/${repo.owner}/${repo.repo}/contents/timeline.json`;
}

function getCommitUrl(repo, commit) {
    return `/repos/${repo.owner}/${repo.repo}/commits/${commit}`;
}

function getCommitsUrl(repo) {
    return `/repos/${repo.owner}/${repo.repo}/commits`;
}

function getFileUrl(repo, file, commit) {
    return `/repos/${repo.owner}/${repo.repo}/contents/${file}?ref=${commit}`;
}

function escapeSpecialChars(str) {
    return str.replace(/&/g, '&amp;').replace(/>/g, '&gt;').replace(/</g, '&lt;');
}

function getModiffBackendUrl() {
    if (config.useLocalBackend) {
        return config.localBackendUrl;
    }
    return config.remoteBackendUrl;
}

window.init = init;
window.fetchData = fetchData;
window.showDiffData = showDiffData;
window.showCommitDetails = showCommitDetails;
