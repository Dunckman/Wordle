// IIFE — немедленно вызываемое функциональное выражение
(function() {
    // базовый "строитель" dom‑элементов
    function Elem(tagName, parentElem = null, attrs = null, textContent = null) {
        // защита от вызова без new
        if (!(this instanceof Elem)) {
            return new Elem(tagName, parentElem, attrs, textContent);   
        }

        this.tagName = tagName;
        this.parentElem = parentElem;
        this.attrs = attrs;
        this.textContent = textContent;

        this.elem = document.createElement(this.tagName);

        // если передали атрибуты
        if (this.attrs) {   
            Object.keys(this.attrs).forEach((name) => {
                const value = this.attrs[name];

                if (name === 'class') {
                    this.elem.className = value;   // специальная обработка class
                } else if (name === 'dataset' && value && typeof value === 'object') {
                    Object.keys(value).forEach((dataName) => {
                        this.elem.dataset[dataName] = value[dataName];   // заполнение data‑атрибутов
                    });
                } else {
                    this.elem.setAttribute(name, value);   // установка произвольного атрибута
                }
            });
        }

        if (this.textContent !== null && this.textContent !== undefined) {
            this.elem.textContent = this.textContent;   // установка текстового содержимого
        }

        if (this.parentElem instanceof HTMLElement) {
            this.parentElem.appendChild(this.elem);   // добавление в обычный dom‑элемент
        } else if (this.parentElem instanceof Elem) {
            this.parentElem.elem.appendChild(this.elem);   // добавление в элемент, созданный через Elem
        }
    }

    Elem.prototype.setParentElem = function setParentElem(parentElem) {
        this.parentElem = parentElem;   // сохранение ссылки на нового родителя

        if (parentElem instanceof HTMLElement) {
            parentElem.appendChild(this.elem);   // добавление к обычному родителю
        } else if (parentElem instanceof Elem) {
            parentElem.elem.appendChild(this.elem);   // добавление к родителю типа Elem
        }

        return this;
    };

    Elem.prototype.setAttributes = function setAttributes(attrs) {
        // проверка на отсутствие переданных атрибутов
        if (!attrs) {
            return this;
        }

        Object.keys(attrs).forEach((name) => {
            const value = attrs[name];

            if (name === 'class') {
                this.elem.className = value;   // специальная обработка class
            } else if (name === 'dataset' && value && typeof value === 'object') {
                Object.keys(value).forEach((dataName) => {
                    this.elem.dataset[dataName] = value[dataName];   // заполнение data‑атрибутов
                });
            } else {
                this.elem.setAttribute(name, value);   // установка произвольного атрибута
            }
        });

        return this;
    };

    Elem.prototype.setText = function setText(text) {
        this.elem.textContent = text;   // установка нового текста
        return this;
    };

    Elem.prototype.addToDOM = function addToDOM() {
        // если родитель не задан, добавить в body
        if (!this.parentElem) {
            document.body.appendChild(this.elem);   
        }
        return this;
    };

    Elem.prototype.toString = function toString() {
        return this.elem.outerHTML;   // строковое представление элемента
    };

    // частный случай для div
    function ElemDiv(options) {
        const parent = options.parent || null;
        const attrs = {};

        // установка css‑класса, если он указан
        if (options.class) {
            attrs.class = options.class;   
        }

        const text = options.text || null;

        Elem.call(this, 'div', parent, attrs, text);   // вызов базового конструктора Elem с указанием тега div
    }

    ElemDiv.prototype = Object.create(Elem.prototype);   // наследование прототипа Elem
    ElemDiv.prototype.constructor = ElemDiv;   // фиксация корректного конструктора

    // собирает страницу на основе данных из json
    function buildPage(data, body) {
        const head = document.head;

        // создание meta charset
        const elemMetaC = new Elem('meta', head, { charset: 'utf-8' });
        elemMetaC.addToDOM();

        // создание meta name content
        const elemMetaNC = new Elem('meta', head, { name: 'viewport', content: 'width=device-width, initial-scale=1.0' });
        elemMetaNC.addToDOM();

        // скрипт виджета
        const elemScript = new Elem(`script`, head, {src:`widget/app.js?t=${Date.now()}`, charset:`utf-8`, defer:`defer`});
        elemScript.addToDOM();

        // создание title
        const elemTitle = new Elem('title', head, null, data.page_title || 'Виджет');
        elemTitle.addToDOM();

        // подключение таблицы стилей
        const elemLink = new Elem('link', head, {
            rel: 'stylesheet',   // атрибут rel для указания типа ссылки
            href: `style.css?t=${Date.now()}`   // добавление параметра времени для обхода кеша
        });
        elemLink.addToDOM();

        // основной заголовок страницы
        const elemH1 = new Elem('h1', body, { class: 'name' }, data.widget_title);
        elemH1.addToDOM();

        // блок с описанием и ссылкой
        const elemDivDesc = new ElemDiv({
            parent: body,
            class: 'description'
        });

        // абзац с текстом описания
        const descP = new Elem('p', elemDivDesc, { class: 'text' }, data.description);   
        descP.addToDOM();

        const descLink = new Elem('a', descP, {
            class: 'link',
            href: data.link,
            target: '_blank'
        }, data.link);
        descLink.addToDOM();

        // картинка виджета, пока без родителя
        const elemImg = new Elem('img', null, {
            class: 'img',
            src: data.path_to_image || 'widget.png',
            alt: data.title || 'Unluck'
        });
        elemImg.addToDOM();

        // общий контейнер под картинку и истории
        const layoutDiv = new ElemDiv({
            parent: body,
            class: 'layout'
        });

        // левая колонка для блоков историй
        const storiesContainer = new ElemDiv({
            parent: layoutDiv,
            class: 'stories'
        });

        // правая колонка с картинкой
        const imagePanel = new ElemDiv({
            parent: layoutDiv,
            class: 'image-panel'
        });

        elemImg.setParentElem(imagePanel);   // добавление картинки в правую колонку

        // блок историй пользователя
        buildStoriesBlock({
            title: data.user.title,
            stories: data.user.stories,
            parent: storiesContainer,
            captionClass: 'story_caption',
            storyClass: 'story'
        });

        // блок историй администратора
        buildStoriesBlock({
            title: data.admin.title,
            stories: data.admin.stories,
            parent: storiesContainer,
            captionClass: 'story_caption',
            storyClass: 'story'
        });

        // блок историй разработчика
        buildStoriesBlock({
            title: data.programmer.title,
            stories: data.programmer.stories,
            parent: storiesContainer,
            captionClass: 'story_caption',
            storyClass: 'story'
        });

        const widgets_block = document.createElement('div');
        widgets_block.className = 'widget-block';

        const classic_widget = document.createElement('wordle-game');
        classic_widget.id = "wordle-standard";
        classic_widget.dataset['css'] = 'widget/app.css';
        
        const cS_wP_widget = document.createElement('wordle-game');
        cS_wP_widget.id = 'wordle-custom-theme';
        cS_wP_widget.dataset['css'] = 'widget/style.css';
        cS_wP_widget.dataset['disablePhysicalKeyboard'] = '';

        const wR_widget = document.createElement('wordle-game');
        wR_widget.id = 'wordle-dark-theme';
        wR_widget.dataset['css'] = 'widget/app.css';
        wR_widget.dataset['colorEmpty'] = '#2c2c2c';
        wR_widget.dataset['colorAbsent'] = '#1a1a1a';
        wR_widget.dataset['colorPresent'] = '#ff6b6b';
        wR_widget.dataset['colorCorrect'] = '#4ecdc4';
        wR_widget.dataset['disableRandom'] = '';
        
        widgets_block.append(classic_widget, cS_wP_widget, wR_widget);
        body.append(widgets_block);
    }

    // создает один блок с исторями определенного типа пользователя
    function buildStoriesBlock(options) {
        const parent = options.parent;
        const blockTitle = options.title;
        const stories = options.stories;
        const captionClass = options.captionClass;
        const storyClass = options.storyClass;

        // общий блок: заголовок + истории
        const blockDiv = new ElemDiv({
            parent,
            class: 'stories_block'
        });

        // заголовок блока
        const h3 = new Elem('h3', blockDiv, { class: 'stories_block_title' }, blockTitle);   
        h3.addToDOM();

        // блок для историй
        const captionDiv = new ElemDiv({
            parent: blockDiv,
            class: captionClass
        });

        // истории
        stories.forEach((storyText) => {
            const storyDiv = new ElemDiv({
                parent: captionDiv,
                class: storyClass
            });

            // абзац с текстом истории
            const p = new Elem('p', storyDiv, { class: 'story_text' }, storyText);
            p.addToDOM();
        });
    }

    // Основная логика (тело бывшей функции run):

    const body = document.body;

    // проверка на открытие по протоколу file://
    if (window.location.protocol === 'file:') {
        const warning = new Elem('div', body, { class: 'warning' },
            'Из-за асинхронной операции fetch браузер блокирует открытие странички по протоколу ' + 
            '\"file://\". Для исправления проблемы нужно использовать HTTP-сервер. Я, например, ' +
            'запускал при помощи расширения Live Server в VS Code.');
        warning.addToDOM();
        return;
    }

    body.classList.add('body');

    // загрузка данных из json
    fetch('data.json', { cache: 'no-cache' })
        .then((response) => {
            if (!response.ok) {
                throw new Error('Не удалось загрузить data.json');   // генерация ошибки при неуспешном статусе
            }
            return response.json();   // преобразование ответа в объект
        })
        .then((data) => {
            buildPage(data, body);   // построение страницы по загруженным данным
        })
        .catch((err) => {
            console.error('ERROR', err);   // вывод сообщения об ошибке в консоль
        });
})();