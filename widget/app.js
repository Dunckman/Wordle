// Класс веб-компонента Wordle, наследуется от HTMLElement для создания кастомного тега <wordle-game>
class HTMLWordleElement extends HTMLElement {
    static activeWidget = null;   // флаг активности виджета
    static CHECK_WORDS_5 = [];   // массив всех пятибуквенных слов из словаря
    static GUESS_WORDS_5 = [];   // массив слов, которые могут быть загаданы (может быть таким же, как CHECK_WORDS_5 или его подмножеством)
    static wordsLoaded = false;   // флаг успешной загрузки словаря

    // Загрузка словаря слов
    static async loadWords() {
        if (this.wordsLoaded) return true;
        
        try {
            // определение пути к папке widget на основе местоположения скрипта
            const isInsideWidgetFolder = window.location.pathname.includes('/widget/');
            const basePath = isInsideWidgetFolder ? '' : 'widget/';
            
            // запрос на получение файлов со словами
            const response_all = await fetch(`${basePath}five_letters_words.txt`);
            const response_guess = await fetch(`${basePath}guess_words.txt`);
            
            const text_all = await response_all.text();   // чтение содержимого файла
            const text_guess = await response_guess.text();   // чтение содержимого файла
            
            // содержиоме файла -> массив слов
            this.CHECK_WORDS_5 = text_all
                .split('\n')
                .map(word => word.trim().toUpperCase())
                .filter(word => word.length === 5);
            
            this.GUESS_WORDS_5 = text_guess
                .split('\n')
                .map(word => word.trim().toUpperCase())
                .filter(word => word.length === 5);
            
            this.wordsLoaded = true;
            console.log(`Загружено всего ${this.CHECK_WORDS_5.length} слов для проверки и ${this.GUESS_WORDS_5.length} слов для угадывания`);
            return true;
        } catch (error) {
            console.error('Ошибка загрузки словаря:', error);
            return false;
        }
    }

    // Нормализация: приводит к верхнему регистру и заменяет Ё на Е
    static normalizeWord(word) {
        // это нужно, т.к. на клавиатуре виджета нет буквы Ё
        return word.toUpperCase().replace(/Ё/g, 'Е');
    }

    // Проверка на наличие слова в словаре
    static isValidWord(word) {
        const normalized = this.normalizeWord(word);
        return this.CHECK_WORDS_5.some(dictWord => this.normalizeWord(dictWord) === normalized);
    }

    // Получение случайного слова из словаря
    static getRandomWord() {
        // если словарь не загружен, возвращаем дефолтное слово
        if (this.GUESS_WORDS_5.length === 0) {
            console.error('Словарь не загружен');
            return 'ВОРДЛ';
        }
        
        return this.normalizeWord(this.GUESS_WORDS_5[Math.floor(Math.random() * this.GUESS_WORDS_5.length)]);
    }

    // Конструктор класса
    constructor() {
        super();   // вызов конструктора родительского класса HTMLElement
        
        // создание Shadow DOM для изоляции стилей и структуры виджета
        this.attachShadow({ mode: 'open' });
        
        // генерируем уникальный ID, если администратор не задал его в HTML
        if (!this.id) {
            this.id = 'wordle-' + Math.random().toString(36).substr(2, 9);
        }
        
        // сохраняем ID для использования в localStorage
        this.instanceId = this.id;
    }

    // Вызывается при изменении любого из наблюдаемых атрибутов
    attributeChangedCallback(name, oldValue, newValue) {
        // если контроллер ещё не создан, выходим
        if (!this.controller) return;
        
        // проверка на изменение атрибута для подключения CSS
        if (name === 'data-css') {
            this.controller.updateCssLink();
            return;
        }
        
        // перезагрузка настройки из data-атрибутов
        this.controller.loadSettings();
        
        // если изменился один из цветов, обновляем пользовательские стили
        if (name.startsWith('data-color-')) {
            this.controller.updateStyles();
        } else if (name === 'data-disable-random') {
            // если изменился флаг отключения случайного слова, обновляем кнопки
            this.controller.updateButtons();
        } else if (name === 'data-disable-physical-keyboard') {
            // если изменился флаг физической клавиатуры, включаем или отключаем её
            if (this.controller.keyboard) {
                if (this.controller.settings.disablePhysicalKeyboard) {
                    this.controller.keyboard.disablePhysicalKeyboard();
                } else {
                    this.controller.keyboard.enablePhysicalKeyboard();
                }
            }
        }
    }

    // Вызывается, когда элемент добавлен в DOM
    connectedCallback() {
        // Базовый класс для плитки с буквой
        class Tile {
            // Конструктор
            constructor(parent, letter = '') {
                this.parent = parent;   // родительский элемент для вставки
                this.letter = letter.toUpperCase();   // буква в верхнем регистре
                this.elem = null;   // DOM-элемент плитки

                this.render();
            }

            // Создание плитки
            render() {
                this.elem = document.createElement('div');
                this.elem.className = 'tile ' + this.getStateClass();
                this.elem.textContent = this.letter;
                this.parent.appendChild(this.elem);
            }

            // CSS-класс
            getStateClass() {
                return 'empty';
            }

            // Установка буквы
            setLetter(letter) {
                this.letter = letter.toUpperCase();
                this.elem.textContent = this.letter;
            }

            // Возврат буквы
            getLetter() {
                return this.letter;
            }

            // Преобразует плитку в другой тип (например, из пустой в правильную)
            transformTo(TileClass) {
                const newTile = new TileClass(this.parent, this.letter);   // создаём новую плитку нужного типа
                this.elem.replaceWith(newTile.elem);
                return newTile;
            }
        }

        // Пустая плитка
        class EmptyTile extends Tile {
            getStateClass() {
                return 'empty';
            }
        }

        // Правильная буква на правильном месте
        class CorrectTile extends Tile {
            getStateClass() {
                return 'correct';
            }
        }

        // Правильная буква не на правильном месте
        class PresentTile extends Tile {
            getStateClass() {
                return 'present';
            }
        }

        // Буквы нет в слове
        class AbsentTile extends Tile {
            getStateClass() {
                return 'absent';
            }
        }

        // Класс ряда из 5 плиток
        class Row {
            // Конструктор
            constructor(parent, wordLength = 5) {
                this.parent = parent;   // родительский элемент
                this.wordLength = wordLength;   // количество плиток в ряду
                this.tiles = [];   // массив плиток
                this.elem = null;   // DOM-элемент ряда

                this.render();
            }

            // Создание строки плиток
            render() {
                this.elem = document.createElement('div');
                this.elem.className = 'row';
                this.parent.appendChild(this.elem);

                // пустые плитки
                for (let i = 0; i < this.wordLength; i++) {
                    const tile = new EmptyTile(this.elem);
                    this.tiles.push(tile);
                }
            }

            // Слово из букв в ряду
            getWord() {
                return this.tiles.map(tile => tile.getLetter()).join('');
            }

            // Проверка слова и раскрашивание плиток
            checkWord(targetWord) {
                // нормализация слов
                const word = HTMLWordleElement.normalizeWord(this.getWord());
                const target = HTMLWordleElement.normalizeWord(targetWord);
                
                // разбивание на буквы
                const targetLetters = target.split('');
                const wordLetters = word.split('');

                // подсчёт количества каждой буквы в целевом слове
                const letterCount = {};
                targetLetters.forEach(letter => {
                    letterCount[letter] = (letterCount[letter] || 0) + 1;
                });

                // массив состояний для каждой плитки
                const states = new Array(this.wordLength).fill(null);
                
                // помечание правильных букв на правильных местах
                wordLetters.forEach((letter, i) => {
                    if (letter === targetLetters[i]) {
                        states[i] = 'correct';   // буква на своём месте
                        letterCount[letter]--;   // уменьшаем счётчик этой буквы
                    }
                });

                // помечание правильных букв не на правильных местах
                wordLetters.forEach((letter, i) => {
                    if (states[i] === null) {   // если ещё не обработана
                        if (letterCount[letter] > 0) {
                            states[i] = 'present';   // буква есть, но не на месте
                            letterCount[letter]--;   // уменьшаем счётчик
                        } else {
                            states[i] = 'absent';   // буквы нет в слове
                        }
                    }
                });

                // применение состояний к плиткам
                states.forEach((state, i) => {
                    if (state === 'correct') {
                        this.tiles[i] = this.tiles[i].transformTo(CorrectTile);
                    } else if (state === 'present') {
                        this.tiles[i] = this.tiles[i].transformTo(PresentTile);
                    } else if (state === 'absent') {
                        this.tiles[i] = this.tiles[i].transformTo(AbsentTile);
                    }
                });

                return states;
            }

            // очистка ряда
            clear() {
                this.tiles.forEach((tile, i) => {
                    if (!(tile instanceof EmptyTile)) {
                        this.tiles[i] = tile.transformTo(EmptyTile);
                    }
                    this.tiles[i].setLetter('');
                });
            }
        }

        // Класс игрового поля из 6 рядов
        class GameField {
            // Конструктор
            constructor(parent, rowCount = 6, wordLength = 5) {
                this.parent = parent;   // родительский элемент
                this.rowCount = rowCount;   // количество рядов (попыток)
                this.wordLength = wordLength;   // длина слова
                this.rows = [];   // массив рядов
                this.currentRow = 0;   // индекс текущего активного ряда
                this.elem = null;   // DOM-элемент игрового поля

                this.render();
            }

            // Создание игрового поля
            render() {
                this.elem = document.createElement('div');
                this.elem.className = 'game-board';
                this.parent.appendChild(this.elem);

                // ряды
                for (let i = 0; i < this.rowCount; i++) {
                    const row = new Row(this.elem, this.wordLength);
                    this.rows.push(row);
                }
            }

            // Активный ряд
            getCurrentRow() {
                return this.rows[this.currentRow];
            }

            // Добавление буквы в первую пустую плитку текущего ряда
            addLetter(letter) {
                const row = this.getCurrentRow();
                
                // поиск первой пустой плитки
                for (let i = 0; i < this.wordLength; i++) {
                    if (row.tiles[i].getLetter() === '') {
                        row.tiles[i].setLetter(letter);
                        break;
                    }
                }
            }

            // Удаление последней введённой буквы из текущего ряда
            removeLetter() {
                const row = this.getCurrentRow();
                
                // поиск последней заполненной плитки с конца
                for (let i = this.wordLength - 1; i >= 0; i--) {
                    if (row.tiles[i].getLetter() !== '') {
                        row.tiles[i].setLetter('');
                        break;
                    }
                }
            }

            // Проверка введённого слова и возврат результата
            submitWord(targetWord) {
                const row = this.getCurrentRow();
                const word = row.getWord();

                // проверка, что слово полностью введено
                if (word.length !== this.wordLength) {
                    return { success: false, message: 'Недостаточно букв' };
                }

                // проверка, что слово есть в словаре
                if (!HTMLWordleElement.isValidWord(word)) {
                    return { success: false, message: 'Такого слова нет в словаре' };
                }

                // проверка и раскрашивание плиток
                const states = row.checkWord(targetWord);
                
                // проверка, все ли буквы угаданы
                const isWin = states.every(state => state === 'correct');

                if (isWin) {
                    return { success: true, isWin: true, message: 'Победа!' };
                }

                // переход к следующему ряду
                this.currentRow++;

                // проверка, не закончились ли попытки
                if (this.currentRow >= this.rowCount) {
                    return { success: true, isGameOver: true, message: `Игра окончена. Слово: ${targetWord}` };
                }

                return { success: true };
            }

            // Сброс игрового поля в начальное состояние
            reset() {
                this.currentRow = 0;
                this.rows.forEach(row => row.clear());
            }

            // Возвращение состояния игрового поля для сохранения в localStorage
            getState() {
                return {
                    currentRow: this.currentRow,   // текущий ряд
                    rows: this.rows.map(row => ({
                        word: row.getWord(),   // слово в ряду
                        states: row.tiles.map(tile => {
                            // определяем состояние каждой плитки
                            if (tile instanceof CorrectTile) return 'correct';
                            if (tile instanceof PresentTile) return 'present';
                            if (tile instanceof AbsentTile) return 'absent';
                            return 'empty';
                        })
                    }))
                };
            }

            // Восстанавление состояния игрового поля из сохранённых данных
            loadState(state) {
                this.currentRow = state.currentRow;   // восстанавление текущего ряда
                
                // восстанавление состояния каждого ряда
                state.rows.forEach((rowState, rowIndex) => {
                    const row = this.rows[rowIndex];
                    
                    // восстанавление букв и состояний плиток
                    for (let i = 0; i < rowState.word.length; i++) {
                        row.tiles[i].setLetter(rowState.word[i]);   // устанавление буквы
                        
                        const stateType = rowState.states[i];
                        
                        // преобразование плитки в соответствующий тип
                        if (stateType === 'correct') {
                            row.tiles[i] = row.tiles[i].transformTo(CorrectTile);
                        } else if (stateType === 'present') {
                            row.tiles[i] = row.tiles[i].transformTo(PresentTile);
                        } else if (stateType === 'absent') {
                            row.tiles[i] = row.tiles[i].transformTo(AbsentTile);
                        }
                    }
                });
            }
        }

        // Класс одной клавиши на экранной клавиатуре
        class Key {
            // Конструктор
            constructor(parent, letter, isWide = false) {
                this.parent = parent;   // родительский элемент
                this.letter = letter;   // текст на клавише
                this.isWide = isWide;   // флаг широкой клавиши (Backspace, Enter)
                this.elem = null;   // DOM-элемент клавиши
                this.onClick = null;   // обработчик клика

                this.render();
            }

            // Создание клавиши
            render() {
                const className = this.isWide ? 'key wide' : 'key';
                this.elem = document.createElement('button');
                this.elem.className = className;
                this.elem.textContent = this.letter;
                this.parent.appendChild(this.elem);

                // добавление обработчика клика
                this.elem.addEventListener('click', () => {
                    if (this.onClick) {
                        this.onClick(this.letter);   // вызов callback при клике
                    }
                });
            }

            // Установка функции-обработчика клика по клавише
            setClickHandler(handler) {
                this.onClick = handler;
            }
        }

        // Класс экранной клавиатуры
        class Keyboard {
            // Конструктор
            constructor(parent, instanceId, disablePhysical = false) {
                this.parent = parent;   // родительский элемент
                this.instanceId = instanceId;   // ID виджета (для отладки)
                this.keys = {};   // объект клавиш для доступа по букве
                this.elem = null;   // DOM-элемент клавиатуры
                this.onKeyPress = null;   // обработчик нажатия клавиши
                this.enabled = false;   // флаг активности клавиатуры
                this.physicalKeyboardEnabled = !disablePhysical;   // флаг активности физической клавиатуры
                this.keydownHandler = null;   // обработчик события keydown

                this.render();
                
                // настройка физической клавиатуры, если она не отключена
                if (this.physicalKeyboardEnabled) {
                    this.setupPhysicalKeyboard();
                }
            }

            // Создание клавиатуры
            render() {
                this.elem = document.createElement('div');
                this.elem.className = 'keyboard';
                this.parent.appendChild(this.elem);

                // раскладка клавиатуры: три ряда с буквами
                const keyboardLayout = [
                    { className: 'top', keys: ['й', 'ц', 'у', 'к', 'е', 'н', 'г', 'ш', 'щ', 'з', 'х', 'ъ'] },
                    { className: 'middle', keys: ['ф', 'ы', 'в', 'а', 'п', 'р', 'о', 'л', 'д', 'ж', 'э'] },
                    { className: 'bottom', keys: ['Backspace', 'я', 'ч', 'с', 'м', 'и', 'т', 'ь', 'б', 'ю', 'Enter'] }
                ];

                // создание рядов клавиш
                keyboardLayout.forEach(rowData => {
                    const row = document.createElement('div');
                    row.className = `keyboard-row ${rowData.className}`;
                    this.elem.appendChild(row);

                    // создание клавиш в ряду
                    rowData.keys.forEach(keyLetter => {
                        const isWide = keyLetter === 'Backspace' || keyLetter === 'Enter';
                        const displayLetter = keyLetter === 'Backspace' ? '↤' : (keyLetter === 'Enter' ? '↵' : keyLetter);
                        
                        const key = new Key(row, displayLetter, isWide);
                        key.setClickHandler(() => this.handleKeyPress(keyLetter));
                        
                        this.keys[keyLetter.toLowerCase()] = key;   // сохраняем в объект для доступа
                    });
                });
            }

            // Настройка обработчика физической клавиатуры
            setupPhysicalKeyboard() {
                this.keydownHandler = (e) => this.handlePhysicalKeyPress(e);   // обработчик
                document.addEventListener('keydown', this.keydownHandler);   // добавление слушателя события
            }

            // Обработка нажатия клавиши (экранной или физической)
            handleKeyPress(key) {
                // вызов обработчика, если клавиатура активна и он есть
                if (this.enabled && this.onKeyPress) {
                    this.onKeyPress(key);
                }
            }

            // Обрабтка нажатия физической клавиши
            handlePhysicalKeyPress(event) {
                // выход, если клавиатура неактивна или физическая клавиатура отключена
                if (!this.enabled || !this.physicalKeyboardEnabled) {
                    return;
                }
                
                const key = event.key.toLowerCase();   // клавиша в нижнем регистре
                
                if (key === 'backspace') {
                    event.preventDefault();   // предотвращение навигации назад в браузере
                    this.handleKeyPress('Backspace');
                } else if (key === 'enter') {
                    this.handleKeyPress('Enter');
                } else if (/^[А-Яа-яёЁ]$/.test(key)) {   // если это русская буква
                    this.handleKeyPress(key);
                }
            }

            // Установка обработчика нажатия клавиши
            setKeyPressHandler(handler) {
                this.onKeyPress = handler;
            }

            // Отключение клавиатуры
            disable() {
                this.enabled = false;
            }

            // Включение клавиатуры
            enable() {
                this.enabled = true;
            }

            // Отключение физической клавиатуры
            disablePhysicalKeyboard() {
                this.physicalKeyboardEnabled = false;
            }

            // Включение физической клавиатуры
            enablePhysicalKeyboard() {
                // создание обработчика, если он не был создан
                if (!this.keydownHandler) {
                    this.setupPhysicalKeyboard();
                }
                this.physicalKeyboardEnabled = true;
            }

            // Удаление обработчика физической клавиатуры (вызывается при удалении виджета)
            destroy() {
                if (this.keydownHandler) {
                    document.removeEventListener('keydown', this.keydownHandler);
                }
            }
        }

        // Класс модального окна для ввода пользовательского слова
        class Modal {
            // Конструктор
            constructor(keyboard, widgetWrapper) {
                this.keyboard = keyboard;   // ссылка на клавиатуру виджета
                this.widgetWrapper = widgetWrapper;   // контейнер виджета
                this.container = null;   // контейнер модального окна
                this.input = null;   // поле ввода
                this.errorText = null;   // текст ошибки
                this.originalHandler = null;   // оригинальный обработчик клавиатуры
                this.resolveCallback = null;   // callback для resolve
            }

            // Создание модального окна и возврат Promise с введённым словом
            show(title, placeholder, submitText = 'ОК', cancelText = 'Отмена') {
                return new Promise((resolve, reject) => {
                    this.resolveCallback = resolve;   // сохранение resolve для доступа из других методов
                    
                    // переключение клавиатуры в режим модального окна
                    this.originalHandler = this.keyboard.onKeyPress;
                    this.keyboard.setKeyPressHandler((key) => this.handleKeyPress(key));
                    this.keyboard.enable();

                    // создание прозрачного контейнера с центрированием
                    this.container = document.createElement('div');
                    this.container.className = 'modal-overlay';
                    this.widgetWrapper.appendChild(this.container);

                    // создание самого модального окна
                    const modal = document.createElement('div');
                    modal.className = 'modal';
                    this.container.appendChild(modal);

                    // заголовок
                    const titleElem = document.createElement('div');
                    titleElem.className = 'modal-title';
                    titleElem.textContent = title;
                    modal.appendChild(titleElem);

                    // поле ввода
                    this.input = document.createElement('input');
                    this.input.className = 'modal-input';
                    this.input.type = 'text';
                    this.input.placeholder = placeholder;
                    this.input.maxLength = 5;
                    modal.appendChild(this.input);

                    // блок ошибки
                    this.errorText = document.createElement('div');
                    this.errorText.className = 'modal-error';
                    modal.appendChild(this.errorText);

                    // контейнер кнопок
                    const buttons = document.createElement('div');
                    buttons.className = 'modal-buttons';
                    modal.appendChild(buttons);

                    // кнопка "Отмена"
                    const cancelBtn = document.createElement('button');
                    cancelBtn.className = 'modal-btn modal-btn-secondary';
                    cancelBtn.textContent = cancelText;
                    buttons.appendChild(cancelBtn);

                    // кнопка "Загадать"
                    const submitBtn = document.createElement('button');
                    submitBtn.className = 'modal-btn modal-btn-primary';
                    submitBtn.textContent = submitText;
                    buttons.appendChild(submitBtn);

                    // обработчик отмены
                    cancelBtn.onclick = () => {
                        console.log('Нажата кнопка Отмена');
                        this.close();
                        reject(new Error('Cancelled'));
                    };

                    // обработчик подтверждения
                    submitBtn.onclick = () => {
                        const word = this.input.value.trim().toUpperCase();
                        if (this.validate(word)) {
                            this.close();
                            resolve(word);
                        }
                    };

                    // обработчик физической клавиатуры (если включена)
                    if (this.keyboard.physicalKeyboardEnabled) {
                        this.input.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter') {
                                const word = this.input.value.trim().toUpperCase();
                                if (this.validate(word)) {
                                    this.close();
                                    resolve(word);
                                }
                            }
                            e.stopPropagation();
                        });
                    } else {
                        // блокировка ввода с физической клавиатуры
                        this.input.addEventListener('keydown', (e) => {
                            if (/^[а-яёА-ЯЁ]$/i.test(e.key) || e.key === 'Backspace') {
                                e.preventDefault();
                            } else if (e.key === 'Enter') {
                                const word = this.input.value.trim().toUpperCase();
                                if (this.validate(word)) {
                                    this.close();
                                    resolve(word);
                                }
                            }
                            e.stopPropagation();
                        });
                    }

                    // фокус на поле ввода
                    setTimeout(() => this.input.focus(), 100);
                });
            }

            // Обработка нажатия экранной клавиши
            handleKeyPress(key) {
                if (key === 'Backspace') {
                    this.input.value = this.input.value.slice(0, -1);
                } else if (key === 'Enter') {
                    const word = this.input.value.trim().toUpperCase();
                    if (this.validate(word)) {
                        this.close();
                        if (this.resolveCallback) {
                            this.resolveCallback(word);
                        }
                    }
                } else if (/^[а-яёА-ЯЁ]$/i.test(key)) {
                    if (this.input.value.length < 5) {
                        this.input.value += key.toUpperCase();
                    }
                }
                this.input.focus();
            }

            // Проверка введённого слова
            validate(word) {
                if (word.length !== 5) {
                    this.showError('Слово должно содержать 5 букв');
                    return false;
                }
                if (!/^[а-яА-ЯЁ]+$/i.test(word)) {
                    this.showError('Только русские буквы');
                    return false;
                }
                if (!HTMLWordleElement.isValidWord(word)) {
                    this.showError('Такого слова нет в словаре');
                    return false;
                }
                return true;
            }

            // Отображение ошибки
            showError(message) {
                this.errorText.textContent = message;
                this.input.classList.add('error');
                setTimeout(() => {
                    this.errorText.textContent = '';
                    this.input.classList.remove('error');
                }, 2000);
            }

            // Закрытие окна
            close() {
                this.keyboard.setKeyPressHandler(this.originalHandler);
                this.keyboard.disable();
                if (this.container) {
                    this.container.remove();
                }
            }
        }

        // объект-контроллер, который управляет виджетом
        const controller = {
            element: this,   // ссылка на сам веб-компонент
            targetWord: null,   // загаданное слово
            isGameOver: false,   // флаг окончания игры
            isReady: false,   // флаг готовности (словарь загружен)
            isFocused: false,   // флаг фокуса на виджете
            cssLink: null,   // элемент <link> для подключения CSS
            wrapper: null,   // элемент-обёртка виджета
            settings: {   // настройки из data-атрибутов
                colorEmpty: null,
                colorAbsent: null,
                colorPresent: null,
                colorCorrect: null,
                disableRandomWord: false,
                disablePhysicalKeyboard: false
            },
            gameField: null,   // игровое поле
            keyboard: null,   // клавиатура

            // Инициализация виджета: (словарь и загадывание)
            async init() {
                // если словарь уже загружен, сразу загадываем слово
                if (HTMLWordleElement.wordsLoaded) {
                    this.isReady = true;
                    this.targetWord = HTMLWordleElement.getRandomWord();
                } else {
                    // иначе загрузка словаря
                    const loaded = await HTMLWordleElement.loadWords();
                    if (loaded) {
                        this.isReady = true;
                        this.targetWord = HTMLWordleElement.getRandomWord();
                    }
                }
                
                // загрузка сохраняемого состояния из localStorage
                this.loadStateFromStorage();
            },

            // Создание виджета
            render() {
                // путь к файлу CSS (из атрибута или app.css по умолчанию)
                const cssPath = this.element.dataset.css || 'app.css';
                
                // элемент <link> для подключения стилей
                this.cssLink = document.createElement('link');
                this.cssLink.setAttribute('rel', 'stylesheet');
                this.cssLink.setAttribute('href', cssPath);
                this.element.shadowRoot.appendChild(this.cssLink);

                // элемент-обёртку для позиционирования модального окна
                this.wrapper = document.createElement('div');
                this.wrapper.className = 'widget-wrapper';
                this.element.shadowRoot.appendChild(this.wrapper);

                // основной контейнер виджета
                const container = document.createElement('div');
                container.className = 'widget';
                this.wrapper.appendChild(container);

                // контейнер для кнопок управления
                const topButtons = document.createElement('div');
                topButtons.className = 'top-buttons';
                container.appendChild(topButtons);

                // кнопка "Случайное слово"
                const randomBtn = document.createElement('button');
                randomBtn.className = 'top-btn random-btn';
                randomBtn.textContent = 'Случайное слово';
                randomBtn.addEventListener('click', () => this.startRandomGame());
                topButtons.appendChild(randomBtn);

                // кнопка "Сбросить"
                const resetBtn = document.createElement('button');
                resetBtn.className = 'reset-btn';
                resetBtn.textContent = 'Сбросить';
                resetBtn.addEventListener('click', () => this.resetGame());
                topButtons.appendChild(resetBtn);

                // кнопка "Загадать слово"
                const customBtn = document.createElement('button');
                customBtn.className = 'top-btn custom-btn';
                customBtn.textContent = 'Загадать слово';
                customBtn.addEventListener('click', () => this.startCustomGame());
                topButtons.appendChild(customBtn);

                // игровое поле
                this.gameField = new GameField(container);
                
                // клавиатура
                this.keyboard = new Keyboard(container, this.element.instanceId, this.settings.disablePhysicalKeyboard);
                this.keyboard.setKeyPressHandler((key) => this.handleKeyPress(key));
                this.keyboard.disable();   // по умолчанию клавиатура отключена
            },

            // Обновление ссылки на файл CSS
            updateCssLink() {
                if (this.cssLink) {
                    const cssPath = this.element.dataset.css || 'app.css';
                    this.cssLink.setAttribute('href', cssPath);
                }
            },

            // Загрузка настроек из data-атрибутов
            loadSettings() {
                this.settings.colorEmpty = this.element.dataset.colorEmpty || null;
                this.settings.colorAbsent = this.element.dataset.colorAbsent || null;
                this.settings.colorPresent = this.element.dataset.colorPresent || null;
                this.settings.colorCorrect = this.element.dataset.colorCorrect || null;
                this.settings.disableRandomWord = 'disableRandom' in this.element.dataset;
                this.settings.disablePhysicalKeyboard = 'disablePhysicalKeyboard' in this.element.dataset;
            },

            // Применение пользовательских цветов к плиткам
            updateStyles() {
                // поиск или создание элемента <style> для пользовательских цветов
                let customStyle = this.element.shadowRoot.querySelector('#custom-colors');
                
                if (!customStyle) {
                    customStyle = document.createElement('style');
                    customStyle.id = 'custom-colors';
                    this.element.shadowRoot.appendChild(customStyle);
                }

                // формирование CSS-правил
                let css = '';

                if (this.settings.colorEmpty) {
                    css += `.empty { background-color: ${this.settings.colorEmpty} !important; }\n`;
                }

                if (this.settings.colorAbsent) {
                    css += `.absent { background-color: ${this.settings.colorAbsent} !important; }\n`;
                }

                if (this.settings.colorPresent) {
                    css += `.present { background-color: ${this.settings.colorPresent} !important; }\n`;
                }

                if (this.settings.colorCorrect) {
                    css += `.correct { background-color: ${this.settings.colorCorrect} !important; }\n`;
                }

                customStyle.textContent = css;   // применение стилей
            },

            // Обновление видимости кнопок в зависимости от настроек
            updateButtons() {
                const randomBtn = this.element.shadowRoot.querySelector('.random-btn');
                const resetBtn = this.element.shadowRoot.querySelector('.reset-btn');
                const customBtn = this.element.shadowRoot.querySelector('.custom-btn');
                
                if (randomBtn) {
                    // если кнопка "Случайное слово" отключена
                    if (this.settings.disableRandomWord) {
                        randomBtn.style.display = 'none';
                        
                        // расширение оставшихся кнопок
                        if (resetBtn && customBtn) {
                            resetBtn.style.width = '200px';
                            customBtn.style.width = '200px';
                        }
                    } else {
                        randomBtn.style.display = 'block';
                        
                        // возвращение стандартной ширины
                        if (resetBtn) {
                            resetBtn.style.width = '100px';
                        }
                    }
                }
            },

            // Настройка обработчика фокуса на виджете
            setupFocusHandlers() {
                // активация виджета при наведении мыши
                this.element.addEventListener('mouseenter', () => {
                    this.setFocus(true);
                });

                // деактивация виджета при уходе мыши
                this.element.addEventListener('mouseleave', () => {
                    this.setFocus(false);
                });

                // активация виджета при клике мыши
                this.element.addEventListener('click', () => {
                    this.setFocus(true);
                });
            },

            // Устанавливает или снимает фокус с виджета
            setFocus(focused) {
                this.isFocused = focused;

                if (focused) {
                    // деактивация другого виджета (если есть)
                    if (HTMLWordleElement.activeWidget && HTMLWordleElement.activeWidget !== this) {
                        HTMLWordleElement.activeWidget.setFocus(false);
                    }
                    
                    HTMLWordleElement.activeWidget = this;   // пометка виджета активным
                    
                    // включение клавиатуры
                    if (this.keyboard) {
                        this.keyboard.enable();
                    }

                    // отобржение рамки вокруг виджета для визуального выделения активации
                    const container = this.element.shadowRoot.querySelector('.widget');
                    if (container) {
                        container.style.boxShadow = '0 0 0 4px #4caf50';
                        container.style.transition = 'box-shadow 0.2s';
                    }
                } else {
                    // отключение клавиатуры
                    if (this.keyboard) {
                        this.keyboard.disable();
                    }

                    // скрытие рамки
                    const container = this.element.shadowRoot.querySelector('.widget');
                    if (container) {
                        container.style.boxShadow = 'none';
                    }
                }
            },

            // Обработка нажатия клавиши
            handleKeyPress(key) {
                // игнорирование, если игра окончена, виджет не готов или не в фокусе
                if (this.isGameOver || !this.isReady || !this.isFocused) {
                    return;
                }

                if (key === 'Backspace') {
                    this.gameField.removeLetter();   // удаление буквы
                    this.saveStateToStorage();   // сохранение состояния
                } else if (key === 'Enter') {
                    const result = this.gameField.submitWord(this.targetWord);   // проверка слова
                    
                    // отображение сообщения, если есть
                    if (result.message) {
                        alert(result.message);
                    }

                    // переключение флага, если игра окончена
                    if (result.isWin || result.isGameOver) {
                        this.isGameOver = true;
                    }
                    
                    this.saveStateToStorage();   // сохранение состояния
                } else {
                    this.gameField.addLetter(key);   // добавление буквы
                    this.saveStateToStorage();
                }
            },

            // Сброс игру и загадывание нового случайного слова
            resetGame() {
                // вывод предупреждения, если словарь ещё не загружен
                if (!this.isReady) {
                    alert('Словарь ещё загружается, подождите...');
                    return;
                }

                this.targetWord = HTMLWordleElement.getRandomWord();   // загадывание нового слова
                this.gameField.reset();   // очистка поля
                this.isGameOver = false;   // переключение флага окончания игры
                
                this.saveStateToStorage();
            },

            // Старт новой игры со случайным словом
            startRandomGame() {
                // вывод предупреждения, если словарь ещё не загружен
                if (!this.isReady) {
                    alert('Словарь ещё загружается, подождите...');
                    return;
                }

                // если кнопка отключена
                if (this.settings.disableRandomWord) {
                    return;
                }

                this.targetWord = HTMLWordleElement.getRandomWord();   // загадывание нового слова
                this.gameField.reset();   // очистка поля
                this.isGameOver = false;   // переключение флага окончания игры

                console.log(this.targetWord);   // вывод слова в консоль для отладки
                
                this.saveStateToStorage();
            },

            // Открывает модальное окно для ввода пользовательского слова
            async startCustomGame() {
                // если словарь ещё не загружен, выводим предупреждение
                if (!this.isReady) {
                    alert('Словарь ещё загружается, подождите...');
                    return;
                }

                // создаём модальное окно, передаём клавиатуру и wrapper
                const modal = new Modal(this.keyboard, this.wrapper);
                
                try {
                    // ждём, пока пользователь введёт слово
                    const word = await modal.show(
                        'Загадать слово',
                        'Введите слово из 5 букв',
                        'Загадать',
                        'Отмена'
                    );
                    
                    this.targetWord = word;   // сохраняем введённое слово
                    this.gameField.reset();   // очищаем поле
                    this.isGameOver = false;   // сбрасываем флаг окончания игры
                    
                    this.saveStateToStorage();   // сохраняем состояние
                } catch (error) {
                    // пользователь отменил ввод, ничего не делаем
                    console.log('Ввод отменён');
                }
            },

            // Сохранение состояния игры в localStorage
            saveStateToStorage() {
                if (!this.gameField) return;   // выход, если поле ещё не создано
                
                // объект состояния
                const state = {
                    targetWord: this.targetWord,   // загаданное слово
                    isGameOver: this.isGameOver,   // флаг окончания игры
                    gameFieldState: this.gameField.getState()   // состояние игрового поля
                };
                
                // сохранение в localStorage с уникальным ключом для каждого виджета
                localStorage.setItem(`wordle-state-${this.element.instanceId}`, JSON.stringify(state));
            },

            // Загрузка сохранённого состояния игры из localStorage
            loadStateFromStorage() {
                // получение сохранённого состояния по уникальному ключу виджета
                const savedState = localStorage.getItem(`wordle-state-${this.element.instanceId}`);
                
                if (savedState) {
                    try {
                        const state = JSON.parse(savedState);   // парсинг JSON
                        this.targetWord = state.targetWord;   // восстанавление загаданного слова
                        this.isGameOver = state.isGameOver;   // восстанавление флага окончания игры
                        
                        // восстанавление состония поля, если есть
                        if (this.gameField && state.gameFieldState) {
                            this.gameField.loadState(state.gameFieldState);
                        }
                    } catch (error) {
                        console.error('Ошибка загрузки состояния:', error);
                    }
                }
            }
        };

        this.controller = controller;   // сохранение контроллера в свойстве элемента
        
        // запуск инициализации виджета
        controller.loadSettings();   // загрузка настроек
        controller.render();   // создание DOM-структуры
        controller.init();   // инициализация (загрузка словаря)
        controller.setupFocusHandlers();   // настройка фокуса
        controller.updateStyles();   // применение пользовательских стилей
        controller.updateButtons();   // обновление кнопок
    }

    // Вызывается при удалении элемента из DOM
    disconnectedCallback() {
        // сброс активности виджета, если он был активным
        if (HTMLWordleElement.activeWidget === this.controller) {
            HTMLWordleElement.activeWidget = null;
        }
        
        // удаление обработчика физической клавиатуры
        if (this.controller && this.controller.keyboard) {
            this.controller.keyboard.destroy();
        }
        
        // сохранение финального состояния перед удалением
        if (this.controller) {
            this.controller.saveStateToStorage();
        }
    }
}

// регистрация веб-компонента в браузере под тегом <wordle-game>
customElements.define('wordle-game', HTMLWordleElement);