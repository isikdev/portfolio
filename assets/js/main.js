const username = 'isikdev';
const apiBaseUrl = 'https://api.github.com';
const reposPerPage = 100;
let reposContainer = null;
let loader = null;
let searchInput = null;
let yearFilterSelect = null;
let totalReposElement = null;
let githubToken = localStorage.getItem('github_token');
let allRepositories = [];
let yearStats = {};
let contributionData = {};
let totalContributions = 0;

const contributionGrid = document.getElementById('contributionGrid');
const contributionCountElement = document.querySelector('.contribution-header h2');

function loadCachedRepositories() {
    const cachedData = localStorage.getItem('github_repos');
    const cachedTime = localStorage.getItem('github_repos_time');

    if (cachedData && cachedTime && (Date.now() - parseInt(cachedTime) < 10800000)) {
        return JSON.parse(cachedData);
    }

    return null;
}

function cacheRepositories(repositories) {
    if (repositories && repositories.length > 0) {
        localStorage.setItem('github_repos', JSON.stringify(repositories));
        localStorage.setItem('github_repos_time', Date.now().toString());
    }
}

function showLoading(message) {
    if (loader) {
        loader.style.display = 'block';
        loader.textContent = message || 'Загрузка...';
    }
}

function showError(message) {
    if (reposContainer) {
        reposContainer.innerHTML = `<p class="error">${message}</p>`;
    }
    if (loader) {
        loader.style.display = 'none';
    }
}

function fetchRepositories() {
    const repositories = loadCachedRepositories();

    if (repositories) {
        console.log('Используются кэшированные данные из localStorage');
        allRepositories = repositories;
        processRepositoryData();
        setupSearchAndFilter();
        totalReposElement.textContent = allRepositories.length;
        displayRepositories(repositories);
        return;
    }

    console.log('Загрузка репозиториев из файла repos.json');
    showLoading('Загрузка репозиториев...');

    fetch('repos.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Не удалось загрузить файл с репозиториями');
            }
            return response.json();
        })
        .then(data => {
            console.log(`Загружено ${data.length} репозиториев из файла`);
            allRepositories = data;
            processRepositoryData();
            setupSearchAndFilter();
            totalReposElement.textContent = allRepositories.length;
            displayRepositories(data);
            cacheRepositories(data);

            if (loader) {
                loader.style.display = 'none';
            }
        })
        .catch(error => {
            console.error('Ошибка загрузки репозиториев:', error);
            showError('Не удалось загрузить репозитории. Пожалуйста, обновите страницу и попробуйте снова.');
        });
}

async function fetchWithRetry(url, retries = 3, options = {}, delay = 1000) {
    let lastError;

    for (let i = 0; i < retries; i++) {
        try {
            const urlWithCache = `${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`;
            return await fetch(urlWithCache, options);
        } catch (error) {
            lastError = error;
            console.log(`Попытка ${i + 1} не удалась, ждем ${delay}мс...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 1.5;
        }
    }

    throw lastError;
}

function simulateContributions() {
    const data = {};
    const totalDays = 365;
    let totalCount = 40;

    const today = new Date();
    const currentYear = today.getFullYear();

    for (let i = 0; i < totalDays; i++) {
        const date = new Date(currentYear, 0, i + 1);

        if (date > today) continue;

        const dateString = date.toISOString().split('T')[0];

        if (Math.random() < 0.2) {
            const count = Math.floor(Math.random() * 5) + 1;
            data[dateString] = count;
        } else {
            data[dateString] = 0;
        }
    }

    return { data, totalCount };
}

async function initApp() {
    try {
        if (loader) {
            loader.style.display = 'block';
        }

        fetchRepositories();

        const contributions = simulateContributions();
        contributionData = contributions.data;
        totalContributions = contributions.totalCount;

        generateContributionGraph();
        updateContributionCount();
    } catch (error) {
        console.error('Ошибка инициализации приложения:', error);
        showError(`Произошла ошибка при инициализации: ${error.message}`);
    }
}

function processRepositoryData() {
    yearStats = {};

    allRepositories.forEach(repo => {
        const createdYear = new Date(repo.created_at).getFullYear();

        if (!yearStats[createdYear]) {
            yearStats[createdYear] = 0;
        }
        yearStats[createdYear]++;

        repo.hasPages = repo.has_pages;
    });

    const yearOptions = Object.keys(yearStats).sort((a, b) => b - a);
    yearOptions.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = `${year} (${yearStats[year]})`;
        yearFilterSelect.appendChild(option);
    });
}

function displayRepositories(repositories) {
    reposContainer.innerHTML = '';

    if (repositories.length === 0) {
        reposContainer.innerHTML = '<p class="no-repos">Репозитории не найдены по вашему запросу.</p>';
        return;
    }

    repositories.forEach(repo => {
        const repoCard = createRepositoryCard(repo);
        reposContainer.appendChild(repoCard);
    });
}

function createRepositoryCard(repo) {
    const card = document.createElement('div');
    card.className = 'repo-card';

    const createdDate = formatDate(repo.created_at);
    const updatedDate = formatDate(repo.updated_at);

    const languageColor = getLanguageColor(repo.language);
    const languageElement = repo.language
        ? `<span class="repo-language"><span class="language-color" style="background-color: ${languageColor}"></span>${repo.language}</span>`
        : '';

    const pagesLink = repo.hasPages
        ? `<a href="https://${username}.github.io/${repo.name}" target="_blank" class="pages-link" title="GitHub Pages"><i class="fas fa-globe"></i></a>`
        : '';

    card.innerHTML = `
        <h3 class="repo-title">
            <a href="${repo.html_url}" target="_blank">${repo.name}</a>
            ${pagesLink}
        </h3>
        <p class="repo-description">${repo.description || 'Нет описания'}</p>
        <div class="repo-meta">
            ${languageElement}
            <span class="repo-date" title="Создан: ${createdDate}">Обновлен: ${updatedDate}</span>
        </div>
    `;

    return card;
}

function setupSearchAndFilter() {
    searchInput.addEventListener('input', filterRepositories);
    yearFilterSelect.addEventListener('change', filterRepositories);
}

function filterRepositories() {
    const searchTerm = searchInput.value.toLowerCase();
    const yearValue = yearFilterSelect.value;

    const filtered = allRepositories.filter(repo => {
        const nameMatch = repo.name.toLowerCase().includes(searchTerm);
        const descMatch = repo.description && repo.description.toLowerCase().includes(searchTerm);

        const yearMatch = yearValue === 'all' || new Date(repo.created_at).getFullYear().toString() === yearValue;

        return (nameMatch || descMatch) && yearMatch;
    });

    displayRepositories(filtered);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU');
}

function getLanguageColor(language) {
    const colors = {
        'JavaScript': '#f1e05a',
        'HTML': '#e34c26',
        'CSS': '#563d7c',
        'PHP': '#4F5D95',
        'Python': '#3572A5',
        'Vue': '#41b883',
        'TypeScript': '#2b7489',
        'Java': '#b07219',
        'C#': '#178600',
        'Ruby': '#701516'
    };

    return colors[language] || '#8b949e';
}

function generateContributionGraph() {
    if (!contributionGrid) return;

    contributionGrid.innerHTML = '';

    const today = new Date();
    const currentYear = today.getFullYear();
    const weeks = 52;
    const daysInWeek = 7;

    const getContributionLevel = (count) => {
        if (count === 0) return 0;
        if (count === 1) return 1;
        if (count <= 3) return 2;
        if (count <= 6) return 3;
        return 4;
    };

    for (let i = 0; i < weeks; i++) {
        for (let j = 0; j < daysInWeek; j++) {
            const dayOfYear = i * 7 + j;
            const date = new Date(currentYear, 0, dayOfYear + 1);

            if (date > today) {
                continue;
            }

            const dateString = date.toISOString().split('T')[0];
            const count = contributionData[dateString] || 0;
            const level = getContributionLevel(count);

            const cell = document.createElement('div');
            cell.className = `day-cell level-${level}`;
            cell.dataset.date = dateString;
            cell.dataset.count = count;
            cell.setAttribute('title', `${count} контрибуций ${dateString}`);

            contributionGrid.appendChild(cell);
        }
    }

    setupYearButtons();
}

function updateContributionCount() {
    if (contributionCountElement) {
        contributionCountElement.textContent = `${totalContributions} контрибуций в ${new Date().getFullYear()}`;
    }
}

function setupYearButtons() {
    const yearButtons = document.querySelectorAll('.year-btn');

    yearButtons.forEach(button => {
        button.addEventListener('click', () => {
            yearButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    reposContainer = document.getElementById('reposContainer');
    loader = document.getElementById('loader');
    searchInput = document.getElementById('repoSearch');
    yearFilterSelect = document.getElementById('yearFilter');
    totalReposElement = document.getElementById('totalRepos');

    initApp();
});