// app.js
const axiosInstance = axios.create({
    baseURL: 'https://api.github.com'
});

function init() {
    // Initialize Metro UI tabs
    Metro.init();
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
            console.log(commit);
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

            // Add click event listener to call showDiffData with the file name
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
    repo.commitData = response.data;

    const commitDetails = document.getElementById('commitDetails');
    commitDetails.innerHTML = '';

    const header = document.createElement('div');
    header.innerHTML = `
        <h2>${repo.commitData.commit.message}</h2>
        <p>Committed by <a href="${repo.commitData.author.html_url}" target="_blank">${repo.commitData.author.login}</a> on ${formatCommitDate(repo.commitData.commit.author.date)}.
        <a href="${repo.commitData.html_url}" target="_blank">${repo.commitData.sha.substring(0,7)}</a></p>
        <p>List of changed model files:</p>
    `;
    commitDetails.appendChild(header);

    // display the list of model files (with the extensions specified in the timeline)
    const changedFiles = repo.commitData.files.map(file => file.filename);

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

        // Add click event listener to call showDiffData with the file name
        link.addEventListener('click', function() {
            showDiffData(repo, file);
        });

        listItem.appendChild(link);
        list.appendChild(listItem);
    });

    commitDetails.appendChild(list);
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

function getPreviousCommit(repo) {
    var previousCommit = null;
    var commits = repo.commits;
    for (var i = 0; i < commits.length; i++) {
        if (commits[i].sha == repo.commit) {
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

async function showDiffData(metadata, filename) {

    var previousCommit = getPreviousCommit(metadata);

    var fromModel = await getFileContents(getFileUrl(metadata, filename, previousCommit.sha));
    var toModel = await getFileContents(getFileUrl(metadata, filename, metadata.commit));

    var request = {
        modelName: filename,
        fromModel: fromModel,
        toModel: toModel,
        metamodels: metadata.metamodels
    }
    console.log(request);

    // Send request to Google Cloud Function
    axios.post('https://europe-west9-delta-vial-428212-f3.cloudfunctions.net/timeline-modiff', request)
        .then(function (response) {
            console.log(response.data);

            var diffHeader = document.getElementById('diffheader');
            diffHeader.innerHTML = `Differences for ${filename}`;

            var diffcode = document.getElementById('diffcode');
            diffcode.innerHTML = escapeSpecialChars(response.data["diff"]);
            Prism.highlightElement(diffcode);

            var munidiffcode = document.getElementById('munidiffcode');
            munidiffcode.innerHTML = escapeSpecialChars(response.data["textual-munidiff"]);
            Prism.highlightElement(munidiffcode);

            var diffDiagram = document.getElementById('svgdiff');
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

function displayData(users) {
    const container = document.getElementById('data-container');
    container.innerHTML = '';

    users.forEach(user => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-header">${user.login}</div>
            <div class="card-content p-2">
                <img src="${user.avatar_url}" alt="${user.login}" class="avatar">
                <p><a href="${user.html_url}" target="_blank">View Profile</a></p>
            </div>
        `;
        container.appendChild(card);
    });
}
