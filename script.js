const harmfulnessThreshold = 7;
let password = localStorage.getItem('password');

if (!password) {
    showPasswordModal();
}

function showPasswordModal() {
    const passwordModal = document.getElementById('passwordModal');
    passwordModal.style.display = 'flex';

    const passwordSubmitButton = document.getElementById('passwordSubmitButton');
    passwordSubmitButton.addEventListener('click', () => {
        const passwordInput = document.getElementById('passwordInput').value.trim();
        if (passwordInput) {
            password = passwordInput;
            localStorage.setItem('password', password);
            passwordModal.style.display = 'none';
        } else {
            alert('Пароль обязателен для использования приложения.');
        }
    });
}

let lastSubmissionTime = 0;
let attemptCount = 0;
const maxAttempts = 3;
let controller = null; // Для отмены запроса

// Список популярных продуктов и блюд
const popularItems = [
    // Ваш список популярных продуктов и блюд
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
    let parsedData = null;
    if (savedData) {
        try {
            parsedData = JSON.parse(savedData);
            // Проверяем наличие новых полей в ответе
            if (!parsedData.caloric_value || !parsedData.caloric_value["per_meal"]) {
                throw new Error("Old format");
            }
            processResult(parsedData, true);
            return;
        } catch (e) {
            // Если старый формат, удаляем сохраненные данные
            localStorage.removeItem(`meal_${searchMealName}`);
        }
    }

    attemptCount = 0;
    checkMeal(searchMealName);
});

function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
    document.getElementById('loadingText').innerText = 'Загрузка...';
    document.getElementById('cancelButton').style.display = 'block';
    document.getElementById('cancelButton').addEventListener('click', cancelLoading);
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
    document.getElementById('cancelButton').removeEventListener('click', cancelLoading);
}

function updateLoadingText() {
    if (attemptCount > 1) {
        document.getElementById('loadingText').innerText =
            `Загрузка, попытка #${attemptCount}`;
    }
}

function cancelLoading() {
    if (controller) {
        controller.abort();
        hideLoading();
        document.getElementById('error').innerText = 'Загрузка отменена.';
    }
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

    controller = new AbortController();
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
        try {
            // Извлекаем content из ответа
            const content = data.choices[0].message.content;
            // Парсим content как JSON
            const result = JSON.parse(content);

            if (result.correct === false) {
                hideLoading();
                document.getElementById('error').innerText =
                    'Введенное значение не является продуктом или блюдом.';
                return;
            }
            hideLoading();
            localStorage.setItem(`meal_${searchMealName}`, JSON.stringify(result));
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
        if (attemptCount < maxAttempts && error.name !== 'AbortError') {
            setTimeout(() => {
                updateLoadingText();
                checkMeal(searchMealName);
            }, attemptCount * 1000);
        } else {
            hideLoading();
            if (error.name === 'AbortError') {
                document.getElementById('error').innerText =
                    'Загрузка отменена.';
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

    // Отображение калорийности на 100 г
    document.getElementById('caloricValue').innerText =
        `Калорийность: ${caloric_value["100g"]} ккал / 100 г`;

    // Отображение калорийности за штуку или порцию
    const perMeal = caloric_value["per_meal"];
    if (perMeal && perMeal.value && perMeal.type) {
        const perMealText = `Калорийность на ${perMeal.type === 'piece' ? 'штуку' : 'порцию'}: ${perMeal.value} ккал`;
        // Добавляем новый элемент для отображения этой информации
        let perMealDiv = document.getElementById('perMealCaloricValue');
        if (!perMealDiv) {
            perMealDiv = document.createElement('div');
            perMealDiv.id = 'perMealCaloricValue';
            perMealDiv.style.fontSize = '18px';
            perMealDiv.style.marginBottom = '15px';
            perMealDiv.style.textAlign = 'center';
            perMealDiv.style.fontWeight = '500';
            document.getElementById('caloricValue').after(perMealDiv);
        }
        perMealDiv.innerText = perMealText;
    } else {
        const perMealDiv = document.getElementById('perMealCaloricValue');
        if (perMealDiv) {
            perMealDiv.innerText = '';
        }
    }

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

    // Проверяем, помещается ли результат на страницу
    adjustResultHeight();
}

function adjustResultHeight() {
    const resultDiv = document.getElementById('result');
    const ratingDescriptionDiv = document.getElementById('ratingDescription');
    const viewportHeight = window.innerHeight;
    const resultRect = resultDiv.getBoundingClientRect();

    // Проверяем, выходит ли результат за пределы экрана
    if (resultRect.bottom > viewportHeight) {
        // Уменьшаем высоту ratingDescription
        const excessHeight = resultRect.bottom - viewportHeight + 20; // небольшой отступ
        const newHeight = ratingDescriptionDiv.offsetHeight - excessHeight;

        if (newHeight > 100) { // минимальная высота
            ratingDescriptionDiv.style.maxHeight = newHeight + 'px';
        }
    } else {
        // Если помещается, устанавливаем стандартную высоту
        ratingDescriptionDiv.style.maxHeight = '200px';
    }
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