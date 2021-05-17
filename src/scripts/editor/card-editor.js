class CardEditor {
    constructor() {
        /** @type {DominoDataCard[]} */
        this.cards = [];
        
        //this.container = elementByPath("card-editor", "div");
        this.promptText = elementByPath("selection/prompt", "span");

        this.textInput = elementByPath("card-editor/text/value", "textarea");
        this.altTextInput = elementByPath("card-editor/image/alt", "textarea");
        this.styleList = elementByPath("card-editor/styles", "select");

        this.iconIconInputs = /** @type {HTMLInputElement[]} */ ([1, 2, 3, 4].map((i) => elementByPath(`card-editor/icons/${i}/icon`, "input")));
        this.iconActionInputs = /** @type {HTMLInputElement[]} */ ([1, 2, 3, 4].map((i) => elementByPath(`card-editor/icons/${i}/action`, "input")));

        const inputs = [this.textInput, ...this.iconIconInputs, ...this.iconActionInputs, this.altTextInput];
        inputs.forEach((input) => input.addEventListener("input", () => this.pushData()));

        setActionHandler("card-editor/image/upload", async () => {
            const [file] = await pickFiles("image/*");
            this.cards[0].image = await fileToCompressedImageURL(file);
            this.pushData();
        });

        setActionHandler("card-editor/image/remove", () => {
            this.cards[0].image = undefined;
            this.pushData();
        });

        setActionHandler("card-editor/text/bold", () => this.wrapSelectedText("**", "**"));
        setActionHandler("card-editor/text/italic", () => this.wrapSelectedText("*", "*"));
        setActionHandler("card-editor/text/strike", () => this.wrapSelectedText("~~", "~~"));
        setActionHandler("card-editor/text/header", () => this.wrapSelectedText("##", "##"));

        setActionHandler("card-editor/styles/edit", () => {
            cardStyleEditor.open();
            cardStyleEditor.setSelectedStyle(this.styleList.value);
            switchTab("sidebar/styles");
        });

        this.styleList.addEventListener("change", () => this.pushData());
    }

    /** @param {DominoDataCard[]} cards */
    openMany(cards) {
        this.promptText.textContent = `${cards.length} cards selected`;

        elementByPath("card-editor/text", "div").hidden = cards.length > 1;
        elementByPath("card-editor/icons", "div").hidden = cards.length > 1;
        elementByPath("card-editor/image", "div").hidden = cards.length > 1;
        elementByPath("card-editor/style", "div").hidden = false;
        elementByPath("selection/link", "button").hidden = cards.length !== 1;
        elementByPath("selection/group", "button").hidden = cards.length === 1;
        this.cards = cards;
        this.pullData();

        refreshDropdown(
            this.styleList,
            [{id: "", name: "default"}, ...boardView.projectData.cardStyles],
            (style) => html("option", { value: style.id }, style.name),
        );
    }

    close() {
        this.cards = []; 

        this.promptText.textContent = `no cards selected`;
        elementByPath("card-editor/text", "div").hidden = true;
        elementByPath("card-editor/icons", "div").hidden = true;
        elementByPath("card-editor/image", "div").hidden = true;
        elementByPath("card-editor/style", "div").hidden = true;
    }

    pullData() {
        if (this.cards.length === 1) {
            const [card] = this.cards;

            this.textInput.value = card.text;
            this.altTextInput.value = card.alttext || "";

            card.icons.slice(0, 4).forEach((icon, i) => {
                this.iconIconInputs[i].value = icon.icon;
                this.iconActionInputs[i].value = icon.action;
            });

            [0, 1, 2, 3].forEach((i) => {
                const icon = card.icons[i] || { icon: "", action: "" };

                this.iconIconInputs[i].value = icon.icon;
                this.iconActionInputs[i].value = icon.action;
            });

            this.styleList.value = card.style ?? "";
        } else {
            const styles = new Set(this.cards.map((card) => card.style));
            const [style] = styles.size === 1 ? styles : [undefined];
            this.styleList.value = style;
        }
    }

    pushData() {
        if (this.cards.length === 1) {
            const [card] = this.cards;
            card.text = this.textInput.value;
            card.icons = [0, 1, 2, 3].map((i) => {
                return { 
                    icon: this.iconIconInputs[i].value, 
                    action: this.iconActionInputs[i].value,
                };
            });
            card.alttext = this.altTextInput.value;
            card.style = this.styleList.value;
        } else {
            const style = this.styleList.value;
            if (style) this.cards.forEach((card) => card.style = style);
        }
    
        this.cards.forEach((card) => boardView.cardToView.get(card).regenerate());
    }

    /** @param {ClipboardEvent} event */
    async paste(event) {
        if (this.cards.length !== 1) return;
        const [card] = this.cards;

        const image = await dataTransferToImage(event.clipboardData);

        if (image) {
            card.image = image;
            this.pushData();
            killEvent(event);
        }
    }

    /**
     * @param {string} prefix
     * @param {string} suffix
     */
    wrapSelectedText(prefix, suffix) {
        const start = this.textInput.selectionStart;
        const end = this.textInput.selectionEnd;
        const text = this.textInput.value.substring(start, end);
        const prev = this.textInput.value;
        const next = prev.slice(0, start) + prefix + text + suffix + prev.slice(end);

        this.textInput.value = next;
        this.pushData();

        this.textInput.select();
        this.textInput.setSelectionRange(start + prefix.length, end + prefix.length);
    }
}
