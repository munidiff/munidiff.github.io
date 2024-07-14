// app.js

function init() {
    // Initialize Metro UI tabs
    Metro.init();
}



function fetchData() {
    axios.get('https://api.github.com/users')
        .then(response => {
            // displayData(response.data);
        })
        .catch(error => {
            console.error('Error fetching data:', error);
        });
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
