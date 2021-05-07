function deleteCardStyle(style) {
    arrayDiscard(boardView.projectData.cardStyles, style);
    boardView.projectData.cards.forEach((card) => {
        if (card.cardStyle === style.id) delete card.cardStyle;
    });
    refreshCardStyles();
}

// please don't tell anyone how i live..
class CardStyleEditorRow {
    /**
     * @param {string} name 
     * @param {keyof DominoDataCardStyle["properties"]} key 
     * @param {HTMLElement[]} inputs 
     */
    constructor(editor, name, key, ...inputs) {
        this.editor = editor;
        this.toggle = html("input", { type: "checkbox", class: "check" });
        this.label = html("span", {}, name);

        this.name = name;
        this.key = key;

        this.elements = [this.toggle, this.label, ...inputs];

        this.toggle.addEventListener("change", () => {
            inputs.forEach((input) => input.disabled = !this.toggle.checked);
            this.push();
        });

        inputs.forEach((input) => input.disabled = true);
        inputs.forEach((input) => input.addEventListener("input", () => this.push()));
    }

    push() {
        const style = this.editor.getSelectedStyle();
        if (!style) return;
        this.pushData(style);
        refreshCardStyles();
    }

    /** @param {DominoDataCardStyle} style */
    pullData(style) {
        
    }

    pushData(style) {
        
    }
}

class CardStyleSize extends CardStyleEditorRow {
    constructor(editor, name, key, min, max, unit="px") {
        const input = html("input", { type: "range", min, max });
        super(editor, name, key, input);
        this.input = input;
        this.unit = unit;
    }

    /** @param {DominoDataCardStyle} style */
    pullData(style) {
        const value = style.properties[this.key];

        if (value !== undefined) {
            this.toggle.checked = true;
            this.input.disabled = false;
            this.input.value = value.slice(0, -this.unit.length);
        } else {
            this.toggle.checked = false;
            this.input.disabled = true;
        }
    }

    /** @param {DominoDataCardStyle} style */
    pushData(style) {
        style.properties[this.key] = this.toggle.checked 
                                   ? this.input.value + this.unit 
                                   : undefined;
    }
}

class CardStyleColor extends CardStyleEditorRow {
    constructor(editor, name, key, alpha=false) {
        const input = html("input", { type: "color" });
        const slider = alpha ? html("input", { type: "range", min: "0", max: "255" }) : undefined;
        if (slider) {
            super(editor, name, key, input, slider);
        } else {
            super(editor, name, key, input);
        }
        this.input = input;
        this.slider = slider;
    }

    /** @param {DominoDataCardStyle} style */
    pullData(style) {
        const value = style.properties[this.key];

        if (value !== undefined) {
            this.toggle.checked = true;
            this.input.disabled = false;
            this.input.value = value.slice(0, 7);
            
            if (this.slider) {
                this.slider.value = parseInt(value.slice(-2), 16).toString();
                this.slider.disabled = false;
            }
        } else {
            this.toggle.checked = false;
            this.input.disabled = true;
            if (this.slider) this.slider.disabled = true;
        }
    }

    /** @param {DominoDataCardStyle} style */
    pushData(style) {
        const alpha = this.slider ? this.slider.valueAsNumber.toString(16) : "ff";
        style.properties[this.key] = this.toggle.checked 
                                   ? this.input.value + alpha
                                   : undefined;
    }
}

class CardStyleToggle extends CardStyleEditorRow {
    /** @param {DominoDataCardStyle} style */
    pullData(style) {
        this.toggle.checked = style.properties[this.key] !== undefined;
    }

    /** @param {DominoDataCardStyle} style */
    pushData(style) {
        style.properties[this.key] = this.toggle.checked ? "true" : undefined;
    }
}

class CardStyleSelect extends CardStyleEditorRow {
    constructor(editor, name, key) {
        const input = html("select", {});
        super(editor, name, key, input);
        this.select = input;
    }

    /** @param {DominoDataCardStyle} style */
    pullData(style) {
        const value = style.properties[this.key];

        if (value !== undefined) {
            this.toggle.checked = true;
            this.select.disabled = false;
            this.select.value = value;
        } else {
            this.toggle.checked = false;
            this.select.disabled = true;
        }
    }

    /** @param {DominoDataCardStyle} style */
    pushData(style) {
        style.properties[this.key] = this.toggle.checked 
                                   ? this.select.value 
                                   : undefined;
    }
}

class CardStyleEditor {
    constructor() {
        this.root = elementByPath("global-editor", "div");

        const container = document.getElementById("card-style-fields");

        this.titleInput = elementByPath("global-editor/title", "input");
        this.textFontRow = new CardStyleSelect(this, "font", "text-font");

        this.rows = [
            new CardStyleSize(this, "size", "text-size", 8, 64),
            new CardStyleColor(this, "color", "text-color"),
            new CardStyleToggle(this, "center", "text-center"),
            new CardStyleColor(this, "color", "card-color", true),
            this.textFontRow,
        ];

        container.replaceChildren(
            html("h2", {}, "text"),
            html("div", { class: "settings-grid" },
                ...this.textFontRow.elements,
                ...this.rows[0].elements,
                ...this.rows[1].elements,
                ...this.rows[2].elements,
            ),
            html("h2", {}, "card"),
            html("div", { class: "settings-grid" },
                ...this.rows[3].elements,
            ),
        );

        this.styleSelect = elementByPath("global-editor/card-styles/selected", "select");
        this.styleSelect.addEventListener("change", () => {
            this.setSelectedStyle(this.styleSelect.value);
        });

        this.customCssInput = elementByPath("global-editor/card-styles/selected/custom-css", "textarea");
        this.customCssInput.addEventListener("input", () => {
            const style = this.getSelectedStyle();
            if (style) style.properties["custom-css"] = this.customCssInput.value;
        });

        this.titleInput.addEventListener("input", () => {
            boardView.projectData.details.title = this.titleInput.value;
        });

        setActionHandler("global-editor/open", () => this.open());
        setActionHandler("global-editor/close", () => this.close());
        setActionHandler("global-editor/toggle", () => this.toggle());

        setActionHandler("global-editor/card-style/new", () => {
            const style = {
                id: nanoid(),
                name: "new style",
                properties: {},
            };

            boardView.projectData.cardStyles.push(style);
            this.setSelectedStyle(style.id);
        });

        setActionHandler("global-editor/card-style/selected/duplicate", () => {
            const style = this.getSelectedStyle();
            const copy = JSON.parse(JSON.stringify(style));
            copy.id = nanoid();
            copy.name += " (copy)";
            boardView.projectData.cardStyles.push(copy);
            this.setSelectedStyle(copy.id);
        });

        setActionHandler("global-editor/card-style/selected/delete", () => {
            if (boardView.projectData.cardStyles.length <= 1) return;
            const style = this.getSelectedStyle();
            deleteCardStyle(style);
            this.setSelectedStyle(boardView.projectData.cardStyles[0].id);
        });
    }

    getSelectedStyle() {
        const styles = boardView.projectData.cardStyles;
        return styles.find((style) => style.id === this.selectedStyle);
    }

    pullData() {
        this.titleInput.value = boardView.projectData.details.title;

        refreshDropdown(
            this.styleSelect,
            boardView.projectData.cardStyles,
            (style) => html("option", { value: style.id }, style.name),
        );

        if (!this.selectedStyle) this.selectedStyle = boardView.projectData.cardStyles[0].id;
        this.styleSelect.value = this.selectedStyle;

        refreshDropdown(
            this.textFontRow.select,
            ["default", "monospace", "serif", "sans-serif", "cursive"],
            (font) => html("option", { value: font }, font),
        );

        const style = this.getSelectedStyle();
        if (!style) return;
        
        this.rows.forEach((row) => row.pullData(style));

        this.customCssInput.value = style.properties["custom-css"] || "";

        const deleteButton = elementByPath("global-editor/card-style/selected/delete", "button");
        deleteButton.disabled = boardView.projectData.cardStyles.length <= 1;
    }

    setSelectedStyle(styleId) {
        this.selectedStyle = styleId;
        this.pullData();
    }

    open() {
        this.root.hidden = false;
        this.pullData();
    }

    close() {
        this.root.hidden = true;
    }

    toggle() {
        if (this.root.hidden) this.open();
        else this.close();
    }
}
