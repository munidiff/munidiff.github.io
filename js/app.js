// app.js

function init() {
    // Initialize Metro UI tabs
    Metro.init();
}

async function fetchData() {
    var repo = getRepoDetails($("#urlInput").val());

    var timeline = await getTimelineMetadata(repo);

    var metamodels = [];
    for (const metamodel of timeline.metamodels) {
        var metamodelUrl = getFileUrl(repo, metamodel, repo.commit);
        var metamodelContent = await getFileContents(metamodelUrl);
        metamodels.push(metamodelContent);
    }
    repo.metamodels = metamodels;

    var modelName = "org.eclipse.epsilon.modiff.demo/timeline/exampleShop.model"

    var previousCommit = getPreviousCommit(repo);

    var fromModel = await getFileContents(getFileUrl(repo, modelName, previousCommit.sha));
    var toModel = await getFileContents(getFileUrl(repo, modelName, repo.commit));

    var request = {
        modelName: modelName,
        fromModel: fromModel,
        toModel: toModel,
        metamodels: metamodels
    }
    console.log(request);

    // Send request to Google Cloud Function
    axios.post('https://europe-west9-delta-vial-428212-f3.cloudfunctions.net/timeline-modiff', request)
        .then(function (response) {
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

    axios.get(getCommitsUrl(metadata)).then(function (response) {
        metadata.commits = response.data;
    });

    return metadata;
}

async function getTimelineMetadata(repo) {
    var url = getTimelineUrl(repo);
    var fileContents = await getFileContents(url);
    var metadata = JSON.parse(fileContents);
    return metadata;
}

async function getFileContents(url) {
    try {
        const response = await axios.get(url);
        const fileContentBase64 = response.data.content;
        const fileContent = buffer.Buffer.from(fileContentBase64, 'base64').toString('utf-8');

        return fileContent;
    } catch (error) {
        console.error('Error fetching the file:', error);
    }
    return null;
}


function getTimelineUrl(repo) {
    return `https://api.github.com/repos/${repo.owner}/${repo.repo}/contents/timeline.json`;
}

function getCommitUrl(repo) {
    return `https://api.github.com/repos/${repo.owner}/${repo.repo}/commits/${repo.commit}`;
}

function getCommitsUrl(repo) {
    return `https://api.github.com/repos/${repo.owner}/${repo.repo}/commits`;
}


function getFileUrl(repo, file, commit) {
    return `https://api.github.com/repos/${repo.owner}/${repo.repo}/contents/${file}?ref=${commit}`;
}

function generateAPICommitUrl(githubUrl) {
    // Extract the parts of the URL after 'github.com/'
    const parts = githubUrl.split('github.com/')[1].split('/');

    // Extract the owner, repo, and commit hash
    const owner = parts[0];
    const repo = parts[1];
    const commit = parts[3];

    return `https://api.github.com/repos/${owner}/${repo}/commits/${commit}`;
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
