const harmfulnessThreshold = 7;
let password = localStorage.getItem('password');

if (!password) {
    password = prompt('Введите пароль:');
    if (password) {
        localStorage.setItem('password', password);
    } else {
        alert('Пароль обязателен для использования приложения.');
    }
}

let lastSubmissionTime = 0;
let attemptCount = 0;
const maxAttempts = 3;

// Список популярных продуктов и блюд
const popularItems = [
    "яблоко", "банан", "молоко", "хлеб", "картофель", "рис", "курица", "говядина", "рыба", "салат", "сыр", "йогурт",
    "макароны", "яйца", "апельсин", "помидор", "огурец", "морковь", "свекла", "лук", "чеснок", "шоколад", "мед",
    "гречка", "овсянка", "манная каша", "виноград", "персик", "груша", "ананас", "киви", "арбуз", "дыня", "малиновое варенье",
    "клубника", "вишня", "черника", "баклажан", "кабачок", "тыква", "капуста", "брокколи", "шпинат", "зелень",
    "фасоль", "горох", "суп", "борщ", "плов", "котлета", "омлет", "блины", "оладьи", "суши", "пицца", "бутерброд",
    "бургеры", "картофель фри", "чипсы", "сосиски", "колбаса", "вареники", "пельмени", "сметана", "майонез",
    "кетчуп", "горчица", "сок", "чай", "кофе", "компот", "лимонад", "вода", "минеральная вода", "какао", "круассан",
    "пирожное", "торт", "мороженое", "мармелад", "зефир", "печенье", "пряник", "орехи", "семечки", "изюм", "курага",
    "чернослив", "шашлык", "лазанья", "спагетти", "равиоли", "соевый соус", "тофу", "грибы", "масло", "оливковое масло",
    "растительное масло", "уксус", "соус табаско", "соль", "сахар", "перец", "корица", "ваниль", "карри"
];

// Обработка автодополнения
const productInput = document.getElementById('productInput');
const suggestionsList = document.getElementById('suggestions');

productInput.addEventListener('input', () => {
    const query = productInput.value.trim().toLowerCase();
    suggestionsList.innerHTML = '';
    if (query.length > 0) {
        const savedKeys = Object.keys(localStorage).filter(key => key.startsWith('meal_'));
        const savedSuggestions = savedKeys
            .map(key => key.replace('meal_', ''))
            .filter(name => name.includes(query));

        const popularSuggestions = popularItems.filter(item => item.includes(query));

        const allSuggestions = [...new Set([...savedSuggestions, ...popularSuggestions])];

        allSuggestions.forEach(suggestion => {
            const li = document.createElement('li');
            li.innerText = suggestion;
            li.addEventListener('click', () => {
                productInput.value = suggestion;
                suggestionsList.innerHTML = '';
            });
            suggestionsList.appendChild(li);
        });
    }
});

document.addEventListener('click', (e) => {
    if (e.target !== productInput) {
        suggestionsList.innerHTML = '';
    }
});

document.getElementById('submitButton').addEventListener('click', function() {
    const currentTime = Date.now();
    if (currentTime - lastSubmissionTime < 5000) {
        document.getElementById('warning').innerText =
            'Подождите 5 секунд перед повторной отправкой.';
        return;
    } else {
        document.getElementById('warning').innerText = '';
    }
    lastSubmissionTime = currentTime;

    const searchMealName = productInput.value.trim().toLowerCase();
    if (searchMealName.length === 0) {
        document.getElementById('error').innerText =
            'Введите название продукта.';
        return;
    } else if (searchMealName.length > 50) {
        document.getElementById('error').innerText =
            'Название продукта не должно превышать 50 символов.';
        return;
    } else {
        document.getElementById('error').innerText = '';
    }

    const savedData = localStorage.getItem(`meal_${searchMealName}`);
    if (savedData) {
        processResult(JSON.parse(savedData), true);
    } else {
        attemptCount = 0;
        checkMeal(searchMealName);
    }
});

function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

function updateLoadingText() {
    document.getElementById('loadingText').innerText =
        `Загрузка, попытка #${attemptCount}`;
}

function checkMeal(searchMealName) {
    attemptCount++;
    showLoading();
    updateLoadingText();

    document.getElementById('result').style.display = 'none';
    document.getElementById('error').innerText = '';
    document.getElementById('warning').innerText = '';

    const payload = {
        password: password,
        text: searchMealName
    };

    const url = 'https://myapihelper.na4u.ru/ai.php';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
    })
    .then(response => response.json())
    .then(data => {
        clearTimeout(timeoutId);
        const content = data['choices'][0]['message']['content'];
        try {
            const result = JSON.parse(content);
            if (result.correct === false) {
                hideLoading();
                document.getElementById('error').innerText =
                    'Введенное значение не является продуктом или блюдом.';
                return;
            }
            hideLoading();
            localStorage.setItem(`meal_${searchMealName}`, content);
            processResult(result, false);
        } catch (e) {
            if (attemptCount < maxAttempts) {
                setTimeout(() => {
                    updateLoadingText();
                    checkMeal(searchMealName);
                }, attemptCount * 1000);
            } else {
                hideLoading();
                document.getElementById('error').innerText =
                    'Ошибка при обработке данных.';
            }
        }
    })
    .catch(error => {
        clearTimeout(timeoutId);
        if (attemptCount < maxAttempts) {
            setTimeout(() => {
                updateLoadingText();
                checkMeal(searchMealName);
            }, attemptCount * 1000);
        } else {
            hideLoading();
            if (error.name === 'AbortError') {
                document.getElementById('error').innerText =
                    'Превышено время ожидания ответа от сервера.';
            } else {
                document.getElementById('error').innerText =
                    'Не удалось получить данные.';
            }
        }
    });
}

function processResult(result, fromCache) {
    document.getElementById('harmfulnessRating').innerHTML = '';
    document.getElementById('savedIndicator').style.display = fromCache ? 'block' : 'none';

    let description = result.description;
    const harmfulness_rating = result.harmfulness_rating;
    let consumption_frequency = result.consumption_frequency;
    const rating_description = result.rating_description;
    const caloric_value = result.caloric_value;

    // Удаление точки в конце описания, если она есть
    if (description.endsWith('.')) {
        description = description.slice(0, -1);
    }

    document.getElementById('description').innerText = description;

    // Отображение вредности цифрой
    const harmfulnessNumberDiv = document.createElement('div');
    harmfulnessNumberDiv.id = 'harmfulnessNumber';
    harmfulnessNumberDiv.innerText =
        `Вредность: ${harmfulness_rating} из 10`;
    document.getElementById('harmfulnessRating')
        .appendChild(harmfulnessNumberDiv);

    // Построение прогресс-бара из отдельных прямоугольников
    const harmfulnessBar = document.createElement('div');
    harmfulnessBar.classList.add('harmfulness-bar');
    for (let i = 1; i <= 10; i++) {
        const rect = document.createElement('div');
        rect.classList.add('harmfulness-rect');
        if (i <= harmfulness_rating) {
            rect.classList.add('filled');
            if (i >= harmfulnessThreshold) {
                rect.style.backgroundColor = 'var(--danger-color)';
            } else {
                // Плавный переход от зеленого к оранжевому
                const green = { r: 16, g: 185, b: 129 }; // #10B981
                const orange = { r: 245, g: 158, b: 11 }; // #F59E0B
                const ratio = (i - 1) / (harmfulnessThreshold - 1);
                const r = Math.round(green.r + ratio *
                    (orange.r - green.r));
                const g = Math.round(green.g + ratio *
                    (orange.g - green.g));
                const b = Math.round(green.b + ratio *
                    (orange.b - green.b));
                rect.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
            }
        }
        harmfulnessBar.appendChild(rect);
    }
    document.getElementById('harmfulnessRating')
        .appendChild(harmfulnessBar);

    // Анимация заполнения прогресс-бара
    const rects = harmfulnessBar.children;
    for (let i = 0; i < harmfulness_rating; i++) {
        setTimeout(() => {
            rects[i].style.opacity = '1';
        }, i * 100);
    }

    // Отображение калорийности
    document.getElementById('caloricValue').innerText =
        `Калорийность: ${caloric_value} ккал / 100 г`;

    // Выделение частоты употребления
    if (harmfulness_rating >= harmfulnessThreshold) {
        consumption_frequency = 'Забанен';
        document.getElementById('consumptionFrequency')
            .style.color = 'var(--danger-color)';
    } else {
        document.getElementById('consumptionFrequency')
            .style.color = 'var(--primary-color)';
    }

    // Приведение частоты употребления к заглавной букве
    consumption_frequency = consumption_frequency.charAt(0).toUpperCase() + consumption_frequency.slice(1);

    document.getElementById('consumptionFrequency').innerText =
        consumption_frequency;

    document.getElementById('ratingDescription').innerText =
        rating_description;

    document.getElementById('result').style.display = 'block';
    document.getElementById('clearCache').style.display = 'block';
}

// Очистка сохраненных данных
document.getElementById('clearCache').addEventListener('click', () => {
    const keys = Object.keys(localStorage);
    for (let key of keys) {
        if (key.startsWith('meal_')) {
            localStorage.removeItem(key);
        }
    }
    document.getElementById('savedIndicator').style.display = 'none';
    document.getElementById('clearCache').style.display = 'none';
    alert('Сохраненные данные очищены.');
});