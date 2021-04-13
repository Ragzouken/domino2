class CardEditor {
    constructor() {
        this.container = elementByPath("editor", "div");
        this.textInput = elementByPath("editor/text", "textarea");

        this.iconIconInputs = /** @type {HTMLInputElement[]} */ ([1, 2, 3, 4].map((i) => ONE(`#editor-icon-select-${i}`)));
        this.iconActionInputs = /** @type {HTMLInputElement[]} */ ([1, 2, 3, 4].map((i) => ONE(`#editor-icon-command-${i}`)));

        const inputs = [this.textInput, ...this.iconIconInputs, ...this.iconActionInputs];
        inputs.forEach((input) => input.addEventListener("input", () => this.pushData(this.card)));
    }

    /** @param {DominoDataCard} card */
    open(card) {
        this.container.hidden = false;
        this.card = card;
        this.pullData(this.card);
    }

    close() {
        this.container.hidden = true;
        this.card = undefined;
    }

    /** @param {DominoDataCard} card */
    pullData(card) {
        this.textInput.value = card.text;

        card.icons.slice(0, 4).forEach((icon, i) => {
            this.iconIconInputs[i].value = icon.icon;
            this.iconActionInputs[i].value = icon.action;
        });

        [0, 1, 2, 3].forEach((i) => {
            const icon = card.icons[i] || { icon: "", action: "" };

            this.iconIconInputs[i].value = icon.icon;
            this.iconActionInputs[i].value = icon.action;
        });
    }

    /** @param {DominoDataCard} card */
    pushData(card) {
        card.text = this.textInput.value;
        card.icons = [0, 1, 2, 3].map((i) => {
            return { 
                icon: this.iconIconInputs[i].value, 
                action: this.iconActionInputs[i].value,
            };
        });

        cardToView.get(card).regenerate();
    }
}
