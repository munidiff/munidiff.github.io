// app.js
const debug = false;

const axiosInstance = axios.create({
    baseURL: 'https://api.github.com',
    timeout: 10000, // Set a timeout (optional)
    headers: {
    }
});

function init() {
    // Initialize Metro UI tabs
    Metro.init();

    // Parse the URL query parameters
    const queryParams = new URLSearchParams(window.location.search);

    // Check if the 'url' parameter exists
    const urlParam = queryParams.get('url');
    if (urlParam) {
        // Set the 'url' parameter value as the input value
        document.getElementById('urlInput').value = urlParam;
    }
}

async function fetchData() {
    // extract details from url
    const repo = getRepoDetails($("#urlInput").val());

    // load timeline config file from repository
    const timeline = await getTimelineMetadata(repo);

    // metamodels in the timeline
    var metamodels = [];
    for (const metamodel of timeline.metamodels) {
        var metamodelUrl = getFileUrl(repo, metamodel, repo.commit);
        var metamodelContent = await getFileContents(metamodelUrl);
        metamodels.push(metamodelContent);
    }
    repo.metamodels = metamodels;

    // list of commits
    axiosInstance.get(getCommitsUrl(repo)).then(function (response) {
        repo.commits = response.data;

        // display the list of commits
        const container = document.getElementById('commitslist');
        container.innerHTML = '';

        repo.commits.forEach(commit => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div class="card-header">
                    <img src="${commit.author.avatar_url}" alt="${commit.author.login}" class="avatar p-1" style="width:32px;height:32px;margin-right:10px"></div>
                <div class="card-content p-2">
                    <p><a href="${commit.author.html_url}" target="_blank">${commit.author.login}</a> authored on ${formatCommitDate(commit.commit.author.date)}.
                    <a href="${commit.html_url}" target="_blank">${commit.sha.substring(0,7)}</a></p>
                </div>
            `;

            const link = document.createElement('a');
            link.href = '#'; // Prevent default link behavior
            link.textContent = commit.commit.message;

            // Add click event listener with the file name
            link.addEventListener('click', function() {
                showCommitDetails(repo, timeline, commit.sha)
            });
            card.children[0].appendChild(link);

            container.appendChild(card);
        });
    });

    showCommitDetails(repo, timeline, repo.commit);
}

async function showCommitDetails(repo, timeline, commit) {

    var response = await axiosInstance.get(getCommitUrl(repo, commit));
    const commitData = response.data;

    const commitDetails = document.getElementById('commitDetails');
    commitDetails.innerHTML = '';

    const header = document.createElement('div');
    header.innerHTML = `
        <h2>${commitData.commit.message}</h2>
        <p>Committed by <a href="${commitData.author.html_url}" target="_blank">${commitData.author.login}</a> on ${formatCommitDate(commitData.commit.author.date)}.
        <a href="${commitData.html_url}" target="_blank">${commitData.sha.substring(0,7)}</a></p>
        <p>List of changed model files:</p>
    `;
    commitDetails.appendChild(header);

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
                    <div class="cell-6">
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
                    <div id="diagramdiff" class="cell-6">
                        <ul data-role="tabs" data-tabs-type="pills" data-expand="true">
                            <li><a href="#diagramdiff">diagram diff</a></li>
                        </ul>
                        <div id="svgdiff_${linkId}">
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

function getPreviousCommit(commits, commit) {
    var previousCommit = null;
    for (var i = 0; i < commits.length; i++) {
        if (commits[i].sha == commit) {
            previousCommit = commits[i + 1];
            break;
        }
    }
    return previousCommit;
}

function getRepoDetails(url) {
    // Extract the parts of the URL after 'github.com/'
    const parts = url.split('github.com/')[1].split('/');

    // Extract the owner, repo, and commit hash
    const owner = parts[0];
    const repo = parts[1];
    const commit = parts[3];

    var metadata = {
        owner: owner,
        repo: repo,
        commit: commit
    };

    return metadata;
}

async function showDiffData(metadata, filename, commit) {

    const linkId = removeNonAlphaNumeric(filename);

    var diffcode = document.getElementById('diffcode_' + linkId);
    if (diffcode.textContent.trim().length > 0) {
        if (debug) {console.log('Request already processed');}
        return;
    }

    var previousCommit = getPreviousCommit(metadata.commits, commit);

    var fromModel = await getFileContents(getFileUrl(metadata, filename, previousCommit.sha));
    var toModel = await getFileContents(getFileUrl(metadata, filename, commit));

    var request = {
        modelName: filename,
        fromModel: fromModel,
        toModel: toModel,
        metamodels: metadata.metamodels
    }
    if (debug) {console.log(request);}

    // Send request to Google Cloud Function
    axios.post('https://europe-west9-delta-vial-428212-f3.cloudfunctions.net/timeline-modiff', request)
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
    var metadata = JSON.parse(fileContents);
    return metadata;
}

async function getFileContents(url) {
    try {
        const response = await axiosInstance.get(url);
        const fileContentBase64 = response.data.content;
        const fileContent = buffer.Buffer.from(fileContentBase64, 'base64').toString('utf-8');

        return fileContent;
    } catch (error) {
        console.error('Error fetching the file:', error);
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

function generateAPICommitUrl(githubUrl) {
    // Extract the parts of the URL after 'github.com/'
    const parts = githubUrl.split('github.com/')[1].split('/');

    // Extract the owner, repo, and commit hash
    const owner = parts[0];
    const repo = parts[1];
    const commit = parts[3];

    return `/repos/${owner}/${repo}/commits/${commit}`;
}

function escapeSpecialChars(str) {
    return str.replace(/&/g, '&amp;').replace(/>/g, '&gt;').replace(/</g, '&lt;');
}
