(function (exports, owl) {
    'use strict';

    function _interopNamespace(e) {
        if (e && e.__esModule) return e;
        var n = Object.create(null);
        if (e) {
            Object.keys(e).forEach(function (k) {
                if (k !== 'default') {
                    var d = Object.getOwnPropertyDescriptor(e, k);
                    Object.defineProperty(n, k, d.get ? d : {
                        enumerable: true,
                        get: function () { return e[k]; }
                    });
                }
            });
        }
        n["default"] = e;
        return Object.freeze(n);
    }

    var owl__namespace = /*#__PURE__*/_interopNamespace(owl);

    // Colors
    const BACKGROUND_GRAY_COLOR = "#f5f5f5";
    const BACKGROUND_HEADER_COLOR = "#F8F9FA";
    const BACKGROUND_HEADER_SELECTED_COLOR = "#E8EAED";
    const BACKGROUND_HEADER_ACTIVE_COLOR = "#595959";
    const TEXT_HEADER_COLOR = "#666666";
    const SELECTION_BORDER_COLOR = "#3266ca";
    const HEADER_BORDER_COLOR = "#C0C0C0";
    const CELL_BORDER_COLOR = "#E2E3E3";
    // Dimensions
    const MIN_ROW_HEIGHT = 10;
    const MIN_COL_WIDTH = 5;
    const HEADER_HEIGHT = 26;
    const HEADER_WIDTH = 48;
    const TOPBAR_HEIGHT = 63;
    const BOTTOMBAR_HEIGHT = 36;
    const DEFAULT_CELL_WIDTH = 96;
    const DEFAULT_CELL_HEIGHT = 23;
    const SCROLLBAR_WIDTH = 15;
    // Fonts
    const DEFAULT_FONT_WEIGHT = "400";
    const DEFAULT_FONT_SIZE = 10;
    const HEADER_FONT_SIZE = 11;
    const DEFAULT_FONT = "'Roboto', arial";

    const colors = [
        "#ff851b",
        "#0074d9",
        "#ffdc00",
        "#7fdbff",
        "#b10dc9",
        "#0ecc40",
        "#39cccc",
        "#f012be",
        "#3d9970",
        "#111111",
        "#01ff70",
        "#ff4136",
        "#aaaaaa",
        "#85144b",
        "#001f3f",
    ];
    /*
     * transform a color number (R * 256^2 + G * 256 + B) into classic RGB
     * */
    function colorNumberString(color) {
        return color.toString(16).padStart(6, "0");
    }
    let colorIndex = 0;
    function getNextColor() {
        colorIndex = ++colorIndex % colors.length;
        return colors[colorIndex];
    }

    //------------------------------------------------------------------------------
    // Coordinate
    //------------------------------------------------------------------------------
    /**
     * Convert a (col) number to the corresponding letter.
     *
     * Examples:
     *     0 => 'A'
     *     25 => 'Z'
     *     26 => 'AA'
     *     27 => 'AB'
     */
    function numberToLetters(n) {
        if (n < 26) {
            return String.fromCharCode(65 + n);
        }
        else {
            return numberToLetters(Math.floor(n / 26) - 1) + numberToLetters(n % 26);
        }
    }
    /**
     * Convert a string (describing a column) to its number value.
     *
     * Examples:
     *     'A' => 0
     *     'Z' => 25
     *     'AA' => 26
     */
    function lettersToNumber(letters) {
        let result = 0;
        const l = letters.length;
        for (let i = 0; i < l; i++) {
            let n = letters.charCodeAt(i) - 65 + (i < l - 1 ? 1 : 0);
            result += n * 26 ** (l - i - 1);
        }
        return result;
    }
    /**
     * Convert a "XC" coordinate to cartesian coordinates.
     *
     * Examples:
     *   A1 => [0,0]
     *   B3 => [1,2]
     *
     * Note: it also accepts lowercase coordinates, but not fixed references
     */
    function toCartesian(xc) {
        xc = xc.toUpperCase();
        const [m, letters, numbers] = xc.match(/\$?([A-Z]*)\$?([0-9]*)/);
        if (m !== xc) {
            throw new Error(`Invalid cell description: ${xc}`);
        }
        const col = lettersToNumber(letters);
        const row = parseInt(numbers, 10) - 1;
        return [col, row];
    }
    /**
     * Convert from cartesian coordinate to the "XC" coordinate system.
     *
     * Examples:
     *   [0,0] => A1
     *   [1,2] => B3
     *
     * Note: it does not support fixed references
     */
    function toXC(col, row) {
        return numberToLetters(col) + String(row + 1);
    }

    /**
     * Convert from a cartesian reference to a Zone
     *
     * Examples:
     *    "A1" ==> Top 0, Bottom 0, Left: 0, Right: 0
     *    "B1:B3" ==> Top 0, Bottom 3, Left: 1, Right: 1
     *    "Sheet1!A1" ==> Top 0, Bottom 0, Left: 0, Right: 0
     *    "Sheet1!B1:B3" ==> Top 0, Bottom 3, Left: 1, Right: 1
     *
     */
    function toZone(xc) {
        xc = xc.split("!").pop();
        const ranges = xc.replace("$", "").split(":");
        let top, bottom, left, right;
        let c = toCartesian(ranges[0].trim());
        left = right = c[0];
        top = bottom = c[1];
        if (ranges.length === 2) {
            let d = toCartesian(ranges[1].trim());
            right = d[0];
            bottom = d[1];
            if (right < left) {
                [right, left] = [left, right];
            }
            if (bottom < top) {
                [bottom, top] = [top, bottom];
            }
        }
        return { top, bottom, left, right };
    }
    /**
     * Convert from zone to a cartesian reference
     *
     */
    function zoneToXc(zone) {
        const { top, bottom, left, right } = zone;
        const isOneCell = top === bottom && left === right;
        return isOneCell ? toXC(left, top) : `${toXC(left, top)}:${toXC(right, bottom)}`;
    }
    /**
     * Compute the union of two zones. It is the smallest zone which contains the
     * two arguments.
     */
    function union(z1, z2) {
        return {
            top: Math.min(z1.top, z2.top),
            left: Math.min(z1.left, z2.left),
            bottom: Math.max(z1.bottom, z2.bottom),
            right: Math.max(z1.right, z2.right),
        };
    }
    /**
     * Two zones are equal if they represent the same area, so we clearly cannot use
     * reference equality.
     */
    function isEqual(z1, z2) {
        return (z1.left === z2.left && z1.right === z2.right && z1.top === z2.top && z1.bottom === z2.bottom);
    }
    /**
     * Return true if two zones overlap, false otherwise.
     */
    function overlap(z1, z2) {
        if (z1.bottom < z2.top || z2.bottom < z1.top) {
            return false;
        }
        if (z1.right < z2.left || z2.right < z1.left) {
            return false;
        }
        return true;
    }
    function isInside(col, row, zone) {
        const { left, right, top, bottom } = zone;
        return col >= left && col <= right && row >= top && row <= bottom;
    }
    /**
     * Recompute the ranges of the zone to contain all the cells in zones, without the cells in toRemoveZones
     * Also regroup zones together to shorten the string
     * (A1, A2, B1, B2, [C1:C2], C3 => [A1:B2],[C1:C3])
     * To do so, the cells are separated and remerged in zones by columns, and then
     * if possible zones in adjacent columns are merged together.
     */
    function recomputeZones(zones, toRemoveZones) {
        const zonesPerColumn = {};
        //separate the existing zones per column
        for (let z of zones) {
            const zone = toZone(z);
            for (let col = zone.left; col <= zone.right; col++) {
                if (zonesPerColumn[col] === undefined) {
                    zonesPerColumn[col] = [];
                }
                zonesPerColumn[col].push({
                    top: zone.top,
                    bottom: zone.bottom,
                    remove: false,
                });
            }
        }
        //separate the to deleted zones per column
        for (let z of toRemoveZones) {
            const zone = toZone(z);
            for (let col = zone.left; col <= zone.right; col++) {
                if (zonesPerColumn[col] === undefined) {
                    zonesPerColumn[col] = [];
                }
                zonesPerColumn[col].push({
                    top: zone.top,
                    bottom: zone.bottom,
                    remove: true,
                });
            }
        }
        const OptimizedZonePerColumn = [];
        //regroup zones per column
        for (let [col, zones] of Object.entries(zonesPerColumn)) {
            OptimizedZonePerColumn.push({
                col: parseInt(col),
                ranges: optimiseColumn(zones),
            });
        }
        //merge zones that spread over multiple columns that can be merged
        const result = mergeColumns(OptimizedZonePerColumn);
        return result.map(zoneToXc);
    }
    /**
     * Recompute the ranges of a column, without the remove cells.
     * takes as input a array of {top, bottom, remove} where top and bottom
     * are the start and end of ranges in the column and remove expresses if the
     * cell should be kept or not.
     */
    function optimiseColumn(zones) {
        const toKeep = new Set();
        const toRemove = new Set();
        for (let zone of zones) {
            for (let x = zone.top; x <= zone.bottom; x++) {
                zone.remove ? toRemove.add(x) : toKeep.add(x);
            }
        }
        const finalElements = [...toKeep]
            .filter((x) => !toRemove.has(x))
            .sort((a, b) => {
            return a - b;
        });
        const newZones = [];
        let currentZone;
        for (let x of finalElements) {
            if (!currentZone) {
                currentZone = { top: x, bottom: x };
            }
            else if (x === currentZone.bottom + 1) {
                currentZone.bottom = x;
            }
            else {
                newZones.push({ top: currentZone.top, bottom: currentZone.bottom });
                currentZone = { top: x, bottom: x };
            }
        }
        if (currentZone) {
            newZones.push({ top: currentZone.top, bottom: currentZone.bottom });
        }
        return newZones;
    }
    /**
     * Verify if ranges in two adjacent columns can be merged in one in one range,
     * and if they can, merge them in the same range.
     */
    function mergeColumns(zonePerCol) {
        const orderedZones = zonePerCol.sort((a, b) => {
            return a.col - b.col;
        });
        const finalZones = [];
        let inProgressZones = [];
        let currentCol = 0;
        for (let index = 0; index <= orderedZones.length - 1; index++) {
            let newInProgress = [];
            if (currentCol + 1 === orderedZones[index].col) {
                for (let z1 of orderedZones[index].ranges) {
                    let merged = false;
                    for (let z2 of inProgressZones) {
                        //extend existing zone with the adjacent col
                        if (z1.top == z2.top && z1.bottom == z2.bottom) {
                            newInProgress.push(z2);
                            merged = true;
                        }
                    }
                    // create new zone as it could not be merged with a previous one
                    if (!merged) {
                        newInProgress.push({ top: z1.top, bottom: z1.bottom, startCol: orderedZones[index].col });
                    }
                }
            }
            else {
                // create new zone as it was not adjacent to the previous zones
                newInProgress = orderedZones[index].ranges.map((zone) => {
                    return {
                        top: zone.top,
                        bottom: zone.bottom,
                        startCol: orderedZones[index].col,
                    };
                });
            }
            //All the zones from inProgressZones that are not transferred in newInprogress
            //are zones that were not extended and are therefore final.
            const difference = inProgressZones.filter((x) => !newInProgress.includes(x));
            for (let x of difference) {
                finalZones.push({ top: x.top, bottom: x.bottom, left: x.startCol, right: currentCol });
            }
            currentCol = orderedZones[index].col;
            inProgressZones = newInProgress;
        }
        //after the last iteration, the unfinished zones need to be finalized to.
        for (let x of inProgressZones) {
            finalZones.push({ top: x.top, bottom: x.bottom, left: x.startCol, right: currentCol });
        }
        return finalZones;
    }
    function mapCellsInZone(zone, sheet, callback, emptyCellValue = undefined) {
        const { top, bottom, left, right } = zone;
        const result = new Array(right - left + 1);
        for (let c = left; c <= right; c++) {
            let col = new Array(bottom - top + 1);
            result[c - left] = col;
            for (let r = top; r <= bottom; r++) {
                let cell = sheet.rows[r].cells[c];
                col[r - top] = cell ? callback(cell) : emptyCellValue;
            }
        }
        return result;
    }

    /*
     * Contains all method to update ranges with grid_manipulation
     */
    function updateRemoveColumns(range, columns) {
        let { left, right, top, bottom } = toZone(range);
        columns = columns.slice().sort((a, b) => b - a);
        for (let column of columns) {
            if (left > column) {
                left -= 1;
            }
            if (left >= column || right >= column) {
                right -= 1;
            }
        }
        if (left > right) {
            return null;
        }
        return toXC(left, top) + ":" + toXC(right, bottom);
    }
    function updateRemoveRows(range, rows) {
        let { left, right, top, bottom } = toZone(range);
        rows = rows.slice().sort((a, b) => b - a);
        for (let row of rows) {
            if (top > row) {
                top -= 1;
            }
            if (top >= row || bottom >= row) {
                bottom -= 1;
            }
        }
        if (top > bottom) {
            return null;
        }
        return toXC(left, top) + ":" + toXC(right, bottom);
    }
    function updateAddColumns(range, column, step) {
        let { left, right, top, bottom } = toZone(range);
        if (left >= column) {
            left += step;
        }
        if (left >= column || right >= column) {
            right += step;
        }
        if (left > right) {
            return null;
        }
        return toXC(left, top) + ":" + toXC(right, bottom);
    }
    function updateAddRows(range, row, step) {
        let { left, right, top, bottom } = toZone(range);
        if (top >= row) {
            top += step;
        }
        if (top >= row || bottom >= row) {
            bottom += step;
        }
        if (top > bottom) {
            return null;
        }
        return toXC(left, top) + ":" + toXC(right, bottom);
    }

    //------------------------------------------------------------------------------
    // Miscellaneous
    //------------------------------------------------------------------------------
    /**
     * Stringify an object, like JSON.stringify, except that the first level of keys
     * is ordered.
     */
    function stringify(obj) {
        return JSON.stringify(obj, Object.keys(obj).sort());
    }
    /**
     * Deep copy arrays, plain objects and primitive values.
     * Throws an error for other types such as class instances.
     * Sparse arrays remain sparse.
     */
    function deepCopy(obj) {
        const result = Array.isArray(obj) ? [] : {};
        switch (typeof obj) {
            case "object": {
                if (obj === null) {
                    return obj;
                }
                else if (!(isPlainObject(obj) || obj instanceof Array)) {
                    throw new Error("Unsupported type: only objects and arrays are supported");
                }
                for (const key in obj) {
                    result[key] = deepCopy(obj[key]);
                }
                return result;
            }
            case "number":
            case "string":
            case "boolean":
            case "function":
            case "undefined":
                return obj;
            default:
                throw new Error(`Unsupported type: ${typeof obj}`);
        }
    }
    /**
     * Check if the object is a plain old javascript object.
     */
    function isPlainObject(obj) {
        return typeof obj === "object" && (obj === null || obj === void 0 ? void 0 : obj.constructor) === Object;
    }
    /**
     * Sanitize the name of a sheet, by eventually removing quotes
     * @param sheetName name of the sheet, potentially quoted with single quotes
     */
    function getUnquotedSheetName(sheetName) {
        if (sheetName.startsWith("'")) {
            sheetName = sheetName.slice(1, -1).replace(/''/g, "'");
        }
        return sheetName;
    }
    /**
     * Add quotes around the sheet name if it contains a space
     * @param sheetName Name of the sheet
     */
    function getComposerSheetName(sheetName) {
        if (sheetName.includes(" ")) {
            sheetName = `'${sheetName}'`;
        }
        return sheetName;
    }
    function clip(val, min, max) {
        return val < min ? min : val > max ? max : val;
    }
    const DEBUG = {};

    /**
     * This regexp is supposed to be as close as possible as the numberRegexp, but
     * its purpose is to be used by the tokenizer.
     *
     * - it tolerates extra characters at the end. This is useful because the tokenizer
     *   only needs to find the number at the start of a string
     * - it does not accept "," as thousand separator, because when we tokenize a
     *   formula, commas are used to separate arguments
     */
    const formulaNumberRegexp = /^-?\d+(\.?\d*(e\d+)?)?(\s*%)?|^-?\.\d+(\s*%)?/;
    const numberRegexp = /^-?\d+(,\d+)*(\.?\d*(e\d+)?)?(\s*%)?$|^-?\.\d+(\s*%)?$/;
    /**
     * Return true if the argument is a "number string".
     *
     * Note that "" (empty string) does not count as a number string
     */
    function isNumber(value) {
        // TO DO: add regexp for DATE string format (ex match: "28 02 2020")
        return numberRegexp.test(value.trim());
    }
    const commaRegexp = /,/g;
    /**
     * Convert a string into a number. It assumes that the string actually represents
     * a number (as determined by the isNumber function)
     *
     * Note that it accepts "" (empty string), even though it does not count as a
     * number from the point of view of the isNumber function.
     */
    function parseNumber(str) {
        let n = Number(str.replace(commaRegexp, ""));
        if (isNaN(n) && str.includes("%")) {
            n = Number(str.split("%")[0]);
            if (!isNaN(n)) {
                return n / 100;
            }
        }
        return n;
    }
    const decimalStandardRepresentation = new Intl.NumberFormat("en-US", {
        useGrouping: false,
        maximumFractionDigits: 10,
    });
    function formatStandardNumber(n) {
        if (Number.isInteger(n)) {
            return n.toString();
        }
        return decimalStandardRepresentation.format(n);
    }
    // this is a cache than can contains decimal representation formats
    // from 0 (minimum) to 20 (maximum) digits after the decimal point
    let decimalRepresentations = [];
    const maximumDecimalPlaces = 20;
    function formatDecimal(n, decimals, sep = "") {
        if (n < 0) {
            return "-" + formatDecimal(-n, decimals);
        }
        const maxDecimals = decimals >= maximumDecimalPlaces ? maximumDecimalPlaces : decimals;
        let formatter = decimalRepresentations[maxDecimals];
        if (!formatter) {
            formatter = new Intl.NumberFormat("en-US", {
                minimumFractionDigits: maxDecimals,
                maximumFractionDigits: maxDecimals,
                useGrouping: false,
            });
            decimalRepresentations[maxDecimals] = formatter;
        }
        let result = formatter.format(n);
        if (sep) {
            let p = result.indexOf(".");
            result = result.replace(/\d(?=(?:\d{3})+(?:\.|$))/g, (m, i) => p < 0 || i < p ? `${m}${sep}` : m);
        }
        return result;
    }
    function formatNumber(value, format) {
        const parts = format.split(";");
        const l = parts.length;
        if (value < 0) {
            if (l > 1) {
                return _formatValue(-value, parts[1]);
            }
            else {
                return "-" + _formatValue(-value, parts[0]);
            }
        }
        const index = l === 3 && value === 0 ? 2 : 0;
        return _formatValue(value, parts[index]);
    }
    function _formatValue(value, format) {
        const parts = format.split(".");
        const decimals = parts.length === 1 ? 0 : parts[1].match(/0/g).length;
        const separator = parts[0].includes(",") ? "," : "";
        const isPercent = format.includes("%");
        if (isPercent) {
            value = value * 100;
        }
        const rawNumber = formatDecimal(value, decimals, separator);
        if (isPercent) {
            return rawNumber + "%";
        }
        return rawNumber;
    }

    /*
     * https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
     * */
    function uuidv4() {
        //@ts-ignore
        if (window.crypto && window.crypto.getRandomValues) {
            //@ts-ignore
            return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
        }
        else {
            // mainly for jest and other browsers that do not have the crypto functionality
            return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
                var r = (Math.random() * 16) | 0, v = c == "x" ? r : (r & 0x3) | 0x8;
                return v.toString(16);
            });
        }
    }

    /*
     * usage: every string should be translated either with _lt if they are registered with a registry at
     *  the load of the app or with Spreadsheet._t in the templates. Spreadsheet._t is exposed in the
     *  sub-env of Spreadsheet components as _t
     * */
    // define a mock translation function, when o-spreadsheet runs in standalone it doesn't translate any string
    let _t = (s) => s;
    function sprintf(s, ...values) {
        if (values.length === 1 && typeof values[0] === "object") {
            const valuesDict = values[0];
            s = s.replace(/%\(?([^\)]+)\)s/g, (match, value) => valuesDict[value]);
        }
        else if (values.length > 0) {
            s = s.replace(/\%s/g, () => values.shift());
        }
        return s;
    }
    /***
     * Allow to inject a translation function from outside o-spreadsheet.
     * @param tfn the function that will do the translation
     */
    function setTranslationMethod(tfn) {
        _t = tfn;
    }
    const _lt = function (s, ...values) {
        return {
            toString: function () {
                return sprintf(_t(s), ...values);
            },
            // casts the object to unknown then to string to trick typescript into thinking that the object it receives is actually a string
            // this way it will be typed correctly (behaves like a string) but tests like typeof _lt("whatever") will be object and not string !
        };
    };

    // -----------------------------------------------------------------------------
    // -----------------------------------------------------------------------------
    // Parsing
    // -----------------------------------------------------------------------------
    const CURRENT_MILLENIAL = 2000; // note: don't forget to update this in 2999
    const CURRENT_YEAR = new Date().getFullYear();
    const INITIAL_1900_DAY$2 = new Date(1899, 11, 30);
    const INITIAL_JS_DAY$1 = new Date(0);
    const DATE_JS_1900_OFFSET$1 = INITIAL_JS_DAY$1 - INITIAL_1900_DAY$2;
    const mdyDateRegexp = /^\d{1,2}(\/|-|\s)\d{1,2}((\/|-|\s)\d{1,4})?$/;
    const ymdDateRegexp = /^\d{3,4}(\/|-|\s)\d{1,2}(\/|-|\s)\d{1,2}$/;
    const timeRegexp = /((\d+(:\d+)?(:\d+)?\s*(AM|PM))|(\d+:\d+(:\d+)?))$/;
    function parseDateTime(str) {
        str = str.trim();
        let time;
        const timeMatch = str.match(timeRegexp);
        if (timeMatch) {
            time = parseTime(timeMatch[0]);
            if (time === null) {
                return null;
            }
            str = str.replace(timeMatch[0], "").trim();
        }
        let date;
        const mdyDateMatch = str.match(mdyDateRegexp);
        const ymdDateMatch = str.match(ymdDateRegexp);
        if (mdyDateMatch || ymdDateMatch) {
            let dateMatch;
            if (mdyDateMatch) {
                dateMatch = mdyDateMatch[0];
                date = parseDate(dateMatch, "mdy");
            }
            else {
                dateMatch = ymdDateMatch[0];
                date = parseDate(dateMatch, "ymd");
            }
            if (date === null) {
                return null;
            }
            str = str.replace(dateMatch, "").trim();
        }
        if (str !== "" || !(date || time)) {
            return null;
        }
        if (date && time) {
            return {
                value: date.value + time.value,
                format: date.format + " " + (time.format === "hhhh:mm:ss" ? "hh:mm:ss" : time.format),
                jsDate: new Date(date.jsDate.getFullYear() + time.jsDate.getFullYear() - 1899, date.jsDate.getMonth() + time.jsDate.getMonth() - 11, date.jsDate.getDate() + time.jsDate.getDate() - 30, date.jsDate.getHours() + time.jsDate.getHours(), date.jsDate.getMinutes() + time.jsDate.getMinutes(), date.jsDate.getSeconds() + time.jsDate.getSeconds()),
            };
        }
        return date || time;
    }
    function parseDate(str, dateFormat) {
        const isMDY = dateFormat === "mdy";
        const isYMD = dateFormat === "ymd";
        if (isMDY || isYMD) {
            const parts = str.split(/\/|-|\s/);
            const monthIndex = isMDY ? 0 : 1;
            const dayIndex = isMDY ? 1 : 2;
            const yearIndex = isMDY ? 2 : 0;
            const month = Number(parts[monthIndex]);
            const day = Number(parts[dayIndex]);
            const leadingZero = (parts[monthIndex].length === 2 && month < 10) || (parts[dayIndex].length === 2 && day < 10);
            const year = parts[yearIndex] ? inferYear(parts[yearIndex]) : CURRENT_YEAR;
            const jsDate = new Date(year, month - 1, day);
            const sep = str.match(/\/|-|\s/)[0];
            if (jsDate.getMonth() !== month - 1 || jsDate.getDate() !== day) {
                // invalid date
                return null;
            }
            const delta = jsDate - INITIAL_1900_DAY$2;
            let format = leadingZero ? `mm${sep}dd` : `m${sep}d`;
            if (parts[yearIndex]) {
                format = isMDY ? format + sep + "yyyy" : "yyyy" + sep + format;
            }
            return {
                value: Math.round(delta / 86400000),
                format: format,
                jsDate,
            };
        }
        return null;
    }
    function inferYear(str) {
        const nbr = Number(str);
        switch (str.length) {
            case 1:
                return CURRENT_MILLENIAL + nbr;
            case 2:
                const offset = CURRENT_MILLENIAL + nbr > CURRENT_YEAR + 10 ? -100 : 0;
                const base = CURRENT_MILLENIAL + offset;
                return base + nbr;
            case 3:
            case 4:
                return nbr;
        }
        return 0;
    }
    function parseTime(str) {
        str = str.trim();
        if (timeRegexp.test(str)) {
            const isAM = /AM/i.test(str);
            const isPM = /PM/i.test(str);
            const strTime = isAM || isPM ? str.substring(0, str.length - 2).trim() : str;
            const parts = strTime.split(/:/);
            const isMinutes = parts.length >= 2;
            const isSeconds = parts.length === 3;
            let hours = Number(parts[0]);
            let minutes = isMinutes ? Number(parts[1]) : 0;
            let seconds = isSeconds ? Number(parts[2]) : 0;
            let format = isSeconds ? "hh:mm:ss" : "hh:mm";
            if (isAM || isPM) {
                format += " a";
            }
            else if (!isMinutes) {
                return null;
            }
            if (hours >= 12 && isAM) {
                hours -= 12;
            }
            else if (hours < 12 && isPM) {
                hours += 12;
            }
            minutes += Math.floor(seconds / 60);
            seconds %= 60;
            hours += Math.floor(minutes / 60);
            minutes %= 60;
            if (hours >= 24) {
                format = "hhhh:mm:ss";
            }
            const jsDate = new Date(1899, 11, 30, hours, minutes, seconds);
            return {
                value: hours / 24 + minutes / 1440 + seconds / 86400,
                format: format,
                jsDate: jsDate,
            };
        }
        return null;
    }
    // -----------------------------------------------------------------------------
    // Conversion
    // -----------------------------------------------------------------------------
    function numberToDate(value) {
        const truncValue = Math.trunc(value);
        let date = new Date(truncValue * 86400 * 1000 - DATE_JS_1900_OFFSET$1);
        let time = value - truncValue;
        time = time < 0 ? 1 + time : time;
        const hours = Math.round(time * 24);
        const minutes = Math.round((time - hours / 24) * 24 * 60);
        const seconds = Math.round((time - hours / 24 - minutes / 24 / 60) * 24 * 60 * 60);
        date.setHours(hours);
        date.setMinutes(minutes);
        date.setSeconds(seconds);
        return date;
    }
    function toNativeDate(date) {
        if (typeof date === "object" && date !== null) {
            if (!date.jsDate) {
                date.jsDate = new Date(date.value * 86400 * 1000 - DATE_JS_1900_OFFSET$1);
            }
            return date.jsDate;
        }
        if (typeof date === "string") {
            let result = parseDateTime(date);
            if (result !== null && result.jsDate) {
                return result.jsDate;
            }
        }
        return numberToDate(toNumber(date));
    }
    // -----------------------------------------------------------------------------
    // Formatting
    // -----------------------------------------------------------------------------
    function formatDateTime(date, format) {
        // TODO: unify the format functions for date and datetime
        // This requires some code to 'parse' or 'tokenize' the format, keep it in a
        // cache, and use it in a single mapping, that recognizes the special list
        // of tokens dd,d,m,y,h, ... and preserves the rest
        const dateTimeFormat = format || date.format;
        const jsDate = toNativeDate(date);
        const indexH = dateTimeFormat.indexOf("h");
        let strDate = "";
        let strTime = "";
        if (indexH > 0) {
            strDate = formatJSDate(jsDate, dateTimeFormat.substring(0, indexH - 1));
            strTime = formatJSTime(jsDate, dateTimeFormat.substring(indexH));
        }
        else if (indexH === 0) {
            strTime = formatJSTime(jsDate, dateTimeFormat);
        }
        else if (indexH < 0) {
            strDate = formatJSDate(jsDate, dateTimeFormat);
        }
        return strDate + (strDate && strTime ? " " : "") + strTime;
    }
    function formatJSDate(date, format) {
        const sep = format.match(/\/|-|\s/)[0];
        const parts = format.split(sep);
        return parts
            .map((p) => {
            switch (p) {
                case "d":
                    return date.getDate();
                case "dd":
                    return date.getDate().toString().padStart(2, "0");
                case "m":
                    return date.getMonth() + 1;
                case "mm":
                    return String(date.getMonth() + 1).padStart(2, "0");
                case "yyyy":
                    return date.getFullYear();
                default:
                    throw new Error(_lt("invalid format"));
            }
        })
            .join(sep);
    }
    function formatJSTime(date, format) {
        let parts = format.split(/:|\s/);
        const dateHours = date.getHours();
        const isMeridian = parts[parts.length - 1] === "a";
        let hours = dateHours;
        let meridian = "";
        if (isMeridian) {
            hours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
            meridian = dateHours >= 12 ? " PM" : " AM";
            parts.pop();
        }
        return (parts
            .map((p) => {
            switch (p) {
                case "hhhh":
                    const helapsedHours = Math.floor((date.getTime() - INITIAL_1900_DAY$2) / (60 * 60 * 1000));
                    return helapsedHours.toString();
                case "hh":
                    return hours.toString().padStart(2, "0");
                case "mm":
                    return date.getMinutes().toString().padStart(2, "0");
                case "ss":
                    return date.getSeconds().toString().padStart(2, "0");
                default:
                    throw new Error("invalid format");
            }
        })
            .join(":") + meridian);
    }

    // HELPERS
    const INITIAL_1900_DAY$1 = new Date(1899, 11, 30);
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const INITIAL_JS_DAY = new Date(0);
    const DATE_JS_1900_OFFSET = INITIAL_JS_DAY - INITIAL_1900_DAY$1;
    const expectNumberValueError = (value) => _lt("The function [[FUNCTION_NAME]] expects a number value, but '%s' is a string, and cannot be coerced to a number.", value);
    function toNumber(value) {
        switch (typeof value) {
            case "number":
                return value;
            case "boolean":
                return value ? 1 : 0;
            case "string":
                if (isNumber(value) || value === "") {
                    return parseNumber(value);
                }
                const internalDate = parseDateTime(value);
                if (internalDate) {
                    return internalDate.value;
                }
                throw new Error(expectNumberValueError(value));
            case "object":
                if (value !== null && value.jsDate) {
                    return value.value;
                }
                return value || 0;
            default:
                return value || 0;
        }
    }
    function strictToNumber(value) {
        if (value === "") {
            throw new Error(expectNumberValueError(value));
        }
        return toNumber(value);
    }
    function visitNumbers(args, cb) {
        for (let n of args) {
            if (Array.isArray(n)) {
                for (let i of n) {
                    for (let j of i) {
                        if (typeof j === "number") {
                            cb(j);
                        }
                        else if (typeof j === "object" && j !== null && j.jsDate) {
                            cb(j.value);
                        }
                    }
                }
            }
            else {
                cb(strictToNumber(n));
            }
        }
    }
    function visitNumbersTextAs0(args, cb) {
        for (let n of args) {
            if (Array.isArray(n)) {
                for (let i of n) {
                    for (let j of i) {
                        if (j !== undefined && j !== null) {
                            if (typeof j === "number") {
                                cb(j);
                            }
                            else if (typeof j === "boolean") {
                                cb(toNumber(j));
                            }
                            else if (typeof j === "object" && j !== null && j.jsDate) {
                                cb(j.value);
                            }
                            else {
                                cb(0);
                            }
                        }
                    }
                }
            }
            else {
                cb(toNumber(n));
            }
        }
    }
    function visitAny(arg, cb) {
        if (Array.isArray(arg)) {
            for (let col of arg) {
                for (let cell of col) {
                    cb(cell);
                }
            }
        }
        else {
            cb(arg);
        }
    }
    function visitAnys(args, rangeCb, argCb) {
        for (let arg of args) {
            if (Array.isArray(arg)) {
                for (let col of arg) {
                    for (let cell of col) {
                        if (!rangeCb(cell))
                            return;
                    }
                }
            }
            else {
                if (!argCb(arg))
                    return;
            }
        }
    }
    function reduceArgs(args, cb, initialValue) {
        let val = initialValue;
        for (let arg of args) {
            visitAny(arg, (a) => {
                val = cb(val, a);
            });
        }
        return val;
    }
    function reduceNumbers(args, cb, initialValue) {
        let val = initialValue;
        visitNumbers(args, (a) => {
            val = cb(val, a);
        });
        return val;
    }
    function reduceNumbersTextAs0(args, cb, initialValue) {
        let val = initialValue;
        visitNumbersTextAs0(args, (a) => {
            val = cb(val, a);
        });
        return val;
    }
    function toString(value) {
        switch (typeof value) {
            case "string":
                return value;
            case "number":
                return value.toString();
            case "boolean":
                return value ? "TRUE" : "FALSE";
            default:
                return "";
        }
    }
    const expectBooleanValueError = (value) => _lt("The function [[FUNCTION_NAME]] expects a boolean value, but '%s' is a text, and cannot be coerced to a number.", value);
    function toBoolean(value) {
        switch (typeof value) {
            case "boolean":
                return value;
            case "string":
                if (value) {
                    let uppercaseVal = value.toUpperCase();
                    if (uppercaseVal === "TRUE") {
                        return true;
                    }
                    if (uppercaseVal === "FALSE") {
                        return false;
                    }
                    throw new Error(expectBooleanValueError(value));
                }
                else {
                    return false;
                }
            case "number":
                return value ? true : false;
            default:
                return false;
        }
    }
    function strictToBoolean(value) {
        if (value === "") {
            throw new Error(expectBooleanValueError(value));
        }
        return toBoolean(value);
    }
    function visitBooleans(args, cb) {
        visitAnys(args, (cell) => {
            if (typeof cell === "boolean") {
                return cb(cell);
            }
            if (typeof cell === "number") {
                return cb(cell ? true : false);
            }
            return true;
        }, (arg) => (arg !== null ? cb(strictToBoolean(arg)) : true));
    }
    function getPredicate(descr, isQuery) {
        let operator;
        let operand;
        let subString = descr.substring(0, 2);
        if (subString === "<=" || subString === ">=" || subString === "<>") {
            operator = subString;
            operand = descr.substring(2);
        }
        else {
            subString = descr.substring(0, 1);
            if (subString === "<" || subString === ">" || subString === "=") {
                operator = subString;
                operand = descr.substring(1);
            }
            else {
                operator = "=";
                operand = descr;
            }
        }
        if (isNumber(operand)) {
            operand = toNumber(operand);
        }
        else if (operand === "TRUE" || operand === "FALSE") {
            operand = toBoolean(operand);
        }
        const result = { operator, operand };
        if (typeof operand === "string") {
            if (isQuery) {
                operand += "*";
            }
            result.regexp = operandToRegExp(operand);
        }
        return result;
    }
    function operandToRegExp(operand) {
        let exp = "";
        let predecessor = "";
        for (let char of operand) {
            if (char === "?" && predecessor !== "~") {
                exp += ".";
            }
            else if (char === "*" && predecessor !== "~") {
                exp += ".*";
            }
            else {
                if (char === "*" || char === "?") {
                    //remove "~"
                    exp = exp.slice(0, -1);
                }
                if (["^", ".", "[", "]", "$", "(", ")", "*", "+", "?", "|", "{", "}", "\\"].includes(char)) {
                    exp += "\\";
                }
                exp += char;
            }
            predecessor = char;
        }
        return new RegExp("^" + exp + "$", "i");
    }
    function evaluatePredicate(value, criterion) {
        const { operator, operand } = criterion;
        if (typeof operand === "number" && operator === "=") {
            return toString(value) === toString(operand);
        }
        if (operator === "<>" || operator === "=") {
            let result;
            if (typeof value === typeof operand) {
                if (criterion.regexp) {
                    result = criterion.regexp.test(value);
                }
                else {
                    result = value === operand;
                }
            }
            else {
                result = false;
            }
            return operator === "=" ? result : !result;
        }
        if (typeof value === typeof operand) {
            switch (operator) {
                case "<":
                    return value < operand;
                case ">":
                    return value > operand;
                case "<=":
                    return value <= operand;
                case ">=":
                    return value >= operand;
            }
        }
        return false;
    }
    /**
     * Functions used especially for predicate evaluation on ranges.
     *
     * Take ranges with same dimensions and take predicates, one for each range.
     * For (i, j) coordinates, if all elements with coordinates (i, j) of each
     * range correspond to the associated predicate, then the function uses a callback
     * function with the parameters "i" and "j".
     *
     * Syntax:
     * visitMatchingRanges([range1, predicate1, range2, predicate2, ...], cb(i,j), likeSelection)
     *
     * - range1 (range): The range to check against predicate1.
     * - predicate1 (string): The pattern or test to apply to range1.
     * - range2: (range, optional, repeatable) ranges to check.
     * - predicate2 (string, optional, repeatable): Additional pattern or test to apply to range2.
     *
     * - cb(i: number, j: number) => void: the callback function.
     *
     * - isQuery (boolean) indicates if the comparison with a string should be done as a SQL-like query.
     * (Ex1 isQuery = true, predicate = "abc", element = "abcde": predicate match the element),
     * (Ex2 isQuery = false, predicate = "abc", element = "abcde": predicate not match the element).
     * (Ex3 isQuery = true, predicate = "abc", element = "abc": predicate match the element),
     * (Ex4 isQuery = false, predicate = "abc", element = "abc": predicate match the element).
     */
    function visitMatchingRanges(args, cb, isQuery = false) {
        const countArg = args.length;
        if (countArg % 2 === 1) {
            throw new Error(_lt(`Function [[FUNCTION_NAME]] expects criteria_range and criterion to be in pairs.`));
        }
        const dimRow = args[0].length;
        const dimCol = args[0][0].length;
        let predicates = [];
        for (let i = 0; i < countArg - 1; i += 2) {
            const criteriaRange = args[i];
            if (criteriaRange.length !== dimRow || criteriaRange[0].length !== dimCol) {
                throw new Error(_lt(`Function [[FUNCTION_NAME]] expects criteria_range to have the same dimension`));
            }
            const description = toString(args[i + 1]);
            predicates.push(getPredicate(description, isQuery));
        }
        for (let i = 0; i < dimRow; i++) {
            for (let j = 0; j < dimCol; j++) {
                let validatedPredicates = true;
                for (let k = 0; k < countArg - 1; k += 2) {
                    const criteriaValue = args[k][i][j];
                    const criterion = predicates[k / 2];
                    validatedPredicates = evaluatePredicate(criteriaValue, criterion);
                    if (!validatedPredicates) {
                        break;
                    }
                }
                if (validatedPredicates) {
                    cb(i, j);
                }
            }
        }
    }
    // -----------------------------------------------------------------------------
    // COMMON FUNCTIONS
    // -----------------------------------------------------------------------------
    /**
     * Perform a dichotomic search and return the index of the nearest match less than
     * or equal to the target. If all values in the range are greater than the target,
     * -1 is returned.
     * If the range is not in sorted order, an incorrect value might be returned.
     *
     * Example:
     * - [3, 6, 10], 3 => 0
     * - [3, 6, 10], 6 => 1
     * - [3, 6, 10], 9 => 1
     * - [3, 6, 10], 42 => 2
     * - [3, 6, 10], 2 => -1
     * - [3, undefined, 6, undefined, 10], 9 => 2
     * - [3, 6, undefined, undefined, undefined, 10], 2 => -1
     */
    function dichotomicPredecessorSearch(range, target) {
        const targetType = typeof target;
        let valMin;
        let valMinIndex = undefined;
        let indexLeft = 0;
        let indexRight = range.length - 1;
        if (typeof range[indexLeft] === targetType && target < range[indexLeft]) {
            return -1;
        }
        if (typeof range[indexRight] === targetType && range[indexRight] <= target) {
            return indexRight;
        }
        let indexMedian;
        let currentIndex;
        let currentVal;
        let currentType;
        while (indexRight - indexLeft >= 0) {
            indexMedian = Math.ceil((indexLeft + indexRight) / 2);
            currentIndex = indexMedian;
            currentVal = range[currentIndex];
            currentType = typeof currentVal;
            // 1 - linear search to find value with the same type
            while (indexLeft <= currentIndex && targetType !== currentType) {
                currentIndex--;
                currentVal = range[currentIndex];
                currentType = typeof currentVal;
            }
            // 2 - check if value match
            if (currentType === targetType && currentVal <= target) {
                if (valMin === undefined ||
                    valMin < currentVal ||
                    (valMin === currentVal && valMinIndex < currentIndex)) {
                    valMin = currentVal;
                    valMinIndex = currentIndex;
                }
            }
            // 3 - give new indexs for the Binary search
            if (currentType === targetType && currentVal > target) {
                indexRight = currentIndex - 1;
            }
            else {
                indexLeft = indexMedian + 1;
            }
        }
        // note that valMinIndex could be 0
        return valMinIndex !== undefined ? valMinIndex : -1;
    }
    /**
     * Perform a dichotomic search and return the index of the nearest match more than
     * or equal to the target. If all values in the range are smaller than the target,
     * -1 is returned.
     * If the range is not in sorted order, an incorrect value might be returned.
     *
     * Example:
     * - [10, 6, 3], 3 => 2
     * - [10, 6, 3], 6 => 1
     * - [10, 6, 3], 9 => 0
     * - [10, 6, 3], 42 => -1
     * - [10, 6, 3], 2 => 2
     * - [10, undefined, 6, undefined, 3], 9 => 0
     * - [10, 6, undefined, undefined, undefined, 3], 2 => 5
     */
    function dichotomicSuccessorSearch(range, target) {
        const targetType = typeof target;
        let valMax;
        let valMaxIndex = undefined;
        let indexLeft = 0;
        let indexRight = range.length - 1;
        if (typeof range[indexLeft] === targetType && target > range[indexLeft]) {
            return -1;
        }
        if (typeof range[indexRight] === targetType && range[indexRight] > target) {
            return indexRight;
        }
        let indexMedian;
        let currentIndex;
        let currentVal;
        let currentType;
        while (indexRight - indexLeft >= 0) {
            indexMedian = Math.ceil((indexLeft + indexRight) / 2);
            currentIndex = indexMedian;
            currentVal = range[currentIndex];
            currentType = typeof currentVal;
            // 1 - linear search to find value with the same type
            while (indexLeft <= currentIndex && targetType !== currentType) {
                currentIndex--;
                currentVal = range[currentIndex];
                currentType = typeof currentVal;
            }
            // 2 - check if value match
            if (currentType === targetType && currentVal >= target) {
                if (valMax === undefined ||
                    valMax > currentVal ||
                    (valMax === currentVal && valMaxIndex > currentIndex)) {
                    valMax = currentVal;
                    valMaxIndex = currentIndex;
                }
            }
            // 3 - give new indexs for the Binary search
            if (currentType === targetType && currentVal <= target) {
                indexRight = currentIndex - 1;
            }
            else {
                indexLeft = indexMedian + 1;
            }
        }
        // note that valMaxIndex could be 0
        return valMaxIndex !== undefined ? valMaxIndex : -1;
    }
    function extractDateValue(arg) {
        if (typeof arg === "object" && arg.jsDate) {
            return arg.value;
        }
        return arg;
    }
    // -----------------------------------------------------------------------------
    // Conversion
    // -----------------------------------------------------------------------------
    function numberToJsDate(value) {
        const truncValue = Math.trunc(value);
        let date = new Date(truncValue * MS_PER_DAY - DATE_JS_1900_OFFSET);
        let time = value - truncValue;
        time = time < 0 ? 1 + time : time;
        const hours = Math.round(time * 24);
        const minutes = Math.round((time - hours / 24) * 24 * 60);
        const seconds = Math.round((time - hours / 24 - minutes / 24 / 60) * 24 * 60 * 60);
        date.setHours(hours);
        date.setMinutes(minutes);
        date.setSeconds(seconds);
        return date;
    }

    /**
     * Registry
     *
     * The Registry class is basically just a mapping from a string key to an object.
     * It is really not much more than an object. It is however useful for the
     * following reasons:
     *
     * 1. it let us react and execute code when someone add something to the registry
     *   (for example, the FunctionRegistry subclass this for this purpose)
     * 2. it throws an error when the get operation fails
     * 3. it provides a chained API to add items to the registry.
     */
    class Registry {
        constructor() {
            this.content = {};
        }
        /**
         * Add an item to the registry
         *
         * Note that this also returns the registry, so another add method call can
         * be chained
         */
        add(key, value) {
            this.content[key] = value;
            return this;
        }
        /**
         * Get an item from the registry
         */
        get(key) {
            if (!(key in this.content)) {
                throw new Error(`Cannot find ${key} in this registry!`);
            }
            return this.content[key];
        }
        /**
         * Get a list of all elements in the registry
         */
        getAll() {
            return Object.values(this.content);
        }
        /**
         * Remove an item from the registry
         */
        remove(key) {
            delete this.content[key];
        }
    }

    //------------------------------------------------------------------------------
    // Arg description DSL
    //------------------------------------------------------------------------------
    const ARG_REGEXP = /(.*?)\((.*?)\)(.*)/;
    const ARG_TYPES = [
        "ANY",
        "BOOLEAN",
        "DATE",
        "NUMBER",
        "STRING",
        "RANGE",
        "RANGE<BOOLEAN>",
        "RANGE<DATE>",
        "RANGE<NUMBER>",
        "RANGE<STRING>",
    ];
    /**
     * This function is meant to be used as a tag for a template strings.
     *
     * Its job is to convert a textual description of the list of arguments into an
     * actual array of Arg, suitable for consumption.
     */
    function args(strings) {
        let lines = strings.split("\n");
        const result = [];
        for (let l of lines) {
            l = l.trim();
            if (l) {
                result.push(makeArg(l));
            }
        }
        return result;
    }
    function makeArg(str) {
        let parts = str.match(ARG_REGEXP);
        let name = parts[1].trim();
        let types = [];
        let isOptional = false;
        let isRepeating = false;
        let isLazy = false;
        let defaultVal;
        for (let param of parts[2].split(",")) {
            const key = param.trim().toUpperCase();
            let type = ARG_TYPES.find((t) => key === t);
            if (type) {
                types.push(type);
            }
            else if (key === "RANGE<ANY>") {
                types.push("RANGE");
            }
            else if (key === "OPTIONAL") {
                isOptional = true;
            }
            else if (key === "REPEATING") {
                isRepeating = true;
            }
            else if (key === "LAZY") {
                isLazy = true;
            }
            else if (key.startsWith("DEFAULT=")) {
                const value = param.trim().slice(8);
                defaultVal = value[0] === '"' ? value.slice(1, -1) : parseFloat(value);
            }
        }
        let description = parts[3].trim();
        const result = {
            name,
            description,
            type: types,
        };
        if (isOptional) {
            result.optional = true;
        }
        if (isRepeating) {
            result.repeating = true;
        }
        if (isLazy) {
            result.lazy = true;
        }
        if (defaultVal !== undefined) {
            result.default = defaultVal;
        }
        return result;
    }
    //------------------------------------------------------------------------------
    // Argument validation
    //------------------------------------------------------------------------------
    function validateArguments(args) {
        let previousArgRepeating = false;
        let previousArgOptional = false;
        for (let current of args) {
            if (previousArgRepeating) {
                throw new Error(_lt("Function ${name} has at least 2 arguments that are repeating. The maximum repeating arguments is 1."));
            }
            if (previousArgOptional && !current.optional) {
                throw new Error(_lt("Function ${name} has at mandatory arguments declared after optional ones. All optional arguments must be after all mandatory arguments."));
            }
            previousArgRepeating = current.repeating;
            previousArgOptional = current.optional;
        }
    }

    // -----------------------------------------------------------------------------
    // ACOS
    // -----------------------------------------------------------------------------
    const ACOS = {
        description: _lt("Inverse cosine of a value, in radians."),
        args: args(`
    value (number) ${_lt("The value for which to calculate the inverse cosine. Must be between -1 and 1, inclusive.")}
  `),
        returns: ["NUMBER"],
        compute: function (value) {
            const _value = toNumber(value);
            if (Math.abs(_value) > 1) {
                throw new Error(_lt("Function [[FUNCTION_NAME]] parameter 1 value is %s. Valid values are between -1 and 1 inclusive.", _value.toString()));
            }
            return Math.acos(_value);
        },
    };
    // -----------------------------------------------------------------------------
    // ACOSH
    // -----------------------------------------------------------------------------
    const ACOSH = {
        description: _lt("Inverse hyperbolic cosine of a number."),
        args: args(`
    value (number) ${_lt("The value for which to calculate the inverse hyperbolic cosine. Must be greater than or equal to 1.")}
  `),
        returns: ["NUMBER"],
        compute: function (value) {
            const _value = toNumber(value);
            if (_value < 1) {
                throw new Error(_lt("Function [[FUNCTION_NAME]] parameter 1 value is %s. It should be greater than or equal to 1.", _value.toString()));
            }
            return Math.acosh(_value);
        },
    };
    // -----------------------------------------------------------------------------
    // ACOT
    // -----------------------------------------------------------------------------
    const ACOT = {
        description: _lt("Inverse cotangent of a value."),
        args: args(`
    value (number) ${_lt("The value for which to calculate the inverse cotangent.")}
  `),
        returns: ["NUMBER"],
        compute: function (value) {
            const _value = toNumber(value);
            const sign = Math.sign(_value) || 1;
            // ACOT has two possible configurations:
            // @compatibility Excel: return Math.PI / 2 - Math.atan(toNumber(_value));
            // @compatibility Google: return sign * Math.PI / 2 - Math.atan(toNumber(_value));
            return (sign * Math.PI) / 2 - Math.atan(_value);
        },
    };
    // -----------------------------------------------------------------------------
    // ACOTH
    // -----------------------------------------------------------------------------
    const ACOTH = {
        description: _lt("Inverse hyperbolic cotangent of a value."),
        args: args(`
    value (number) ${_lt("The value for which to calculate the inverse hyperbolic cotangent. Must not be between -1 and 1, inclusive.")}
  `),
        returns: ["NUMBER"],
        compute: function (value) {
            const _value = toNumber(value);
            if (Math.abs(_value) <= 1) {
                throw new Error(_lt("Function [[FUNCTION_NAME]] parameter 1 value is %s. Valid values cannot be between -1 and 1 inclusive.", _value.toString()));
            }
            return Math.log((_value + 1) / (_value - 1)) / 2;
        },
    };
    // -----------------------------------------------------------------------------
    // ASIN
    // -----------------------------------------------------------------------------
    const ASIN = {
        description: _lt("Inverse sine of a value, in radians."),
        args: args(`
    value (number) ${_lt("The value for which to calculate the inverse sine. Must be between -1 and 1, inclusive.")}
  `),
        returns: ["NUMBER"],
        compute: function (value) {
            const _value = toNumber(value);
            if (Math.abs(_value) > 1) {
                throw new Error(_lt("Function [[FUNCTION_NAME]] parameter 1 value is %S. Valid values are between -1 and 1 inclusive.", _value.toString()));
            }
            return Math.asin(_value);
        },
    };
    // -----------------------------------------------------------------------------
    // ASINH
    // -----------------------------------------------------------------------------
    const ASINH = {
        description: _lt("Inverse hyperbolic sine of a number."),
        args: args(`
    value (number) ${_lt("The value for which to calculate the inverse hyperbolic sine.")}
  `),
        returns: ["NUMBER"],
        compute: function (value) {
            return Math.asinh(toNumber(value));
        },
    };
    // -----------------------------------------------------------------------------
    // ATAN
    // -----------------------------------------------------------------------------
    const ATAN = {
        description: _lt("Inverse tangent of a value, in radians."),
        args: args(`
    value (number) ${_lt("The value for which to calculate the inverse tangent.")}
  `),
        returns: ["NUMBER"],
        compute: function (value) {
            return Math.atan(toNumber(value));
        },
    };
    // -----------------------------------------------------------------------------
    // ATAN2
    // -----------------------------------------------------------------------------
    const ATAN2 = {
        description: _lt("Angle from the X axis to a point (x,y), in radians."),
        args: args(`
    x (number) ${_lt("The x coordinate of the endpoint of the line segment for which to calculate the angle from the x-axis.")}
    y (number) ${_lt("The y coordinate of the endpoint of the line segment for which to calculate the angle from the x-axis.")}
  `),
        returns: ["NUMBER"],
        compute: function (x, y) {
            const _x = toNumber(x);
            const _y = toNumber(y);
            if (_x === 0 && _y === 0) {
                throw new Error(_lt(`Function [[FUNCTION_NAME]] caused a divide by zero error.`));
            }
            return Math.atan2(_y, _x);
        },
    };
    // -----------------------------------------------------------------------------
    // ATANH
    // -----------------------------------------------------------------------------
    const ATANH = {
        description: _lt("Inverse hyperbolic tangent of a number."),
        args: args(`
    value (number) ${_lt("The value for which to calculate the inverse hyperbolic tangent. Must be between -1 and 1, exclusive.")}
  `),
        returns: ["NUMBER"],
        compute: function (value) {
            const _value = toNumber(value);
            if (Math.abs(_value) >= 1) {
                throw new Error(_lt("Function [[FUNCTION_NAME]] parameter 1 value is %s. Valid values are between -1 and 1 exclusive.", _value.toString()));
            }
            return Math.atanh(_value);
        },
    };
    // -----------------------------------------------------------------------------
    // CEILING
    // -----------------------------------------------------------------------------
    const CEILING = {
        description: _lt(`Rounds number up to nearest multiple of factor.`),
        args: args(`
    value (number) ${_lt("The value to round up to the nearest integer multiple of factor.")}
    factor (number, optional, default=1) ${_lt("The number to whose multiples value will be rounded.")}
  `),
        returns: ["NUMBER"],
        compute: function (value, factor = 1) {
            const _value = toNumber(value);
            const _factor = toNumber(factor);
            if (_value > 0 && _factor < 0) {
                throw new Error(_lt("Function CEILING expects the parameter '%s' to be positive when parameter '%s' is positive. Change '%s' from [%s] to a positive value.", CEILING.args[1].name, CEILING.args[0].name, CEILING.args[1].name, _factor.toString()));
            }
            return _factor ? Math.ceil(_value / _factor) * _factor : 0;
        },
    };
    // -----------------------------------------------------------------------------
    // CEILING.MATH
    // -----------------------------------------------------------------------------
    const CEILING_MATH = {
        description: _lt(`Rounds number up to nearest multiple of factor.`),
        args: args(`
    number (number) ${_lt("The value to round up to the nearest integer multiple of significance.")}
    significance (number, optional, default=1) ${_lt("The number to whose multiples number will be rounded. The sign of significance will be ignored.")}
    mode (number, optional, default=0) ${_lt("If number is negative, specifies the rounding direction. If 0 or blank, it is rounded towards zero. Otherwise, it is rounded away from zero.")}
  `),
        returns: ["NUMBER"],
        compute: function (number, significance = 1, mode = 0) {
            let _significance = toNumber(significance);
            if (_significance === 0) {
                return 0;
            }
            const _number = toNumber(number);
            _significance = Math.abs(_significance);
            if (_number >= 0) {
                return Math.ceil(_number / _significance) * _significance;
            }
            const _mode = toNumber(mode);
            if (_mode === 0) {
                return -Math.floor(Math.abs(_number) / _significance) * _significance;
            }
            return -Math.ceil(Math.abs(_number) / _significance) * _significance;
        },
    };
    // -----------------------------------------------------------------------------
    // CEILING.PRECISE
    // -----------------------------------------------------------------------------
    const CEILING_PRECISE = {
        description: _lt(`Rounds number up to nearest multiple of factor.`),
        args: args(`
    number (number) ${_lt("The value to round up to the nearest integer multiple of significance.")}
    significance (number, optional, default=1) ${_lt("The number to whose multiples number will be rounded.")}
  `),
        returns: ["NUMBER"],
        compute: function (number, significance) {
            return CEILING_MATH.compute(number, significance, 0);
        },
    };
    // -----------------------------------------------------------------------------
    // COS
    // -----------------------------------------------------------------------------
    const COS = {
        description: _lt("Cosine of an angle provided in radians."),
        args: args(`
    angle (number) ${_lt("The angle to find the cosine of, in radians.")}
  `),
        returns: ["NUMBER"],
        compute: function (angle) {
            return Math.cos(toNumber(angle));
        },
    };
    // -----------------------------------------------------------------------------
    // COSH
    // -----------------------------------------------------------------------------
    const COSH = {
        description: _lt("Hyperbolic cosine of any real number."),
        args: args(`
    value (number) ${_lt("Any real value to calculate the hyperbolic cosine of.")}
  `),
        returns: ["NUMBER"],
        compute: function (value) {
            return Math.cosh(toNumber(value));
        },
    };
    // -----------------------------------------------------------------------------
    // COT
    // -----------------------------------------------------------------------------
    const COT = {
        description: _lt("Cotangent of an angle provided in radians."),
        args: args(`
    angle (number) ${_lt("The angle to find the cotangent of, in radians.")}
  `),
        returns: ["NUMBER"],
        compute: function (angle) {
            const _angle = toNumber(angle);
            if (_angle === 0) {
                throw new Error(_lt(`Evaluation of function [[FUNCTION_NAME]] caused a divide by zero error.`));
            }
            return 1 / Math.tan(_angle);
        },
    };
    // -----------------------------------------------------------------------------
    // COTH
    // -----------------------------------------------------------------------------
    const COTH = {
        description: _lt("Hyperbolic cotangent of any real number."),
        args: args(`
    value (number) ${_lt("Any real value to calculate the hyperbolic cotangent of.")}
  `),
        returns: ["NUMBER"],
        compute: function (value) {
            const _value = toNumber(value);
            if (_value === 0) {
                throw new Error(_lt(`Evaluation of function [[FUNCTION_NAME]] caused a divide by zero error.`));
            }
            return 1 / Math.tanh(_value);
        },
    };
    // -----------------------------------------------------------------------------
    // COUNTBLANK
    // -----------------------------------------------------------------------------
    const COUNTBLANK = {
        description: _lt("Number of empty values."),
        args: args(`
    value1 (any, range) ${_lt("The first value or range in which to count the number of blanks.")}
    value2 (any, range, optional, repeating) ${_lt("Additional values or ranges in which to count the number of blanks.")}
  `),
        returns: ["NUMBER"],
        compute: function () {
            return reduceArgs(arguments, (acc, a) => (a === null || a === undefined || a === "" ? acc + 1 : acc), 0);
        },
    };
    // -----------------------------------------------------------------------------
    // COUNTIF
    // -----------------------------------------------------------------------------
    const COUNTIF = {
        description: _lt("A conditional count across a range."),
        args: args(`
    range (range) ${_lt("The range that is tested against criterion.")}
    criterion (string) ${_lt("The pattern or test to apply to range.")}
  `),
        returns: ["NUMBER"],
        compute: function () {
            let count = 0;
            visitMatchingRanges(arguments, (i, j) => {
                count += 1;
            });
            return count;
        },
    };
    // -----------------------------------------------------------------------------
    // COUNTIFS
    // -----------------------------------------------------------------------------
    const COUNTIFS = {
        description: _lt("Count values depending on multiple criteria."),
        args: args(`
    criteria_range (range) ${_lt("The range to check against criterion1.")}
    criterion (string) ${_lt("The pattern or test to apply to criteria_range1.")}
    additional_values (any, range, optional, repeating) ${_lt("Additional criteria_range and criterion to check.")}
  `),
        // @compatibility: on google sheets, args definitions are next:
        // criteria_range1 (any, range) The range to check against criterion1.
        // criterion1 (string) The pattern or test to apply to criteria_range1.
        // criteria_range2 (any, range, optional repeating) Additional ranges over which to evaluate the additional criteria. The filtered set will be the intersection of the sets produced by each criterion-range pair.
        // criterion2 (string, optional repeating) Additional criteria to check.
        returns: ["NUMBER"],
        compute: function () {
            let count = 0;
            visitMatchingRanges(arguments, (i, j) => {
                count += 1;
            });
            return count;
        },
    };
    // -----------------------------------------------------------------------------
    // COUNTUNIQUE
    // -----------------------------------------------------------------------------
    function isDefined(value) {
        switch (value) {
            case undefined:
                return false;
            case "":
                return false;
            case null:
                return false;
            default:
                return true;
        }
    }
    const COUNTUNIQUE = {
        description: _lt("Counts number of unique values in a range."),
        args: args(`
    value1 (any, range) ${_lt("The first value or range to consider for uniqueness.")}
    value2 (any, range, optional, repeating) ${_lt("Additional values or ranges to consider for uniqueness.")}
  `),
        returns: ["NUMBER"],
        compute: function () {
            return reduceArgs(arguments, (acc, a) => (isDefined(a) ? acc.add(a) : acc), new Set()).size;
        },
    };
    // -----------------------------------------------------------------------------
    // COUNTUNIQUEIFS
    // -----------------------------------------------------------------------------
    const COUNTUNIQUEIFS = {
        description: _lt("Counts number of unique values in a range, filtered by a set of criteria."),
        args: args(`
    range (range) ${_lt("The range of cells from which the number of unique values will be counted.")}
    criteria_range1 (range) ${_lt("The range of cells over which to evaluate criterion1.")}
    criterion1 (string) ${_lt("The pattern or test to apply to criteria_range1, such that each cell that evaluates to TRUE will be included in the filtered set.")}
    additional_values (any, range, optional, repeating) ${_lt("Additional criteria_range and criterion to check.")}
  `),
        // @compatibility: on google sheets, args definitions are next:
        // range (any, range) The range of cells from which the number of unique values will be counted.
        // criteria_range1 (any, range) The range of cells over which to evaluate criterion1.
        // criterion1 (string) The pattern or test to apply to criteria_range1, such that each cell that evaluates to TRUE will be included in the filtered set.
        // criteria_range2 (any, range, optional, repeating) Additional ranges over which to evaluate the additional criteria. The filtered set will be the intersection of the sets produced by each criterion-range pair.
        // criterion2 (string, optional, repeating) The pattern or test to apply to criteria_range2.
        returns: ["NUMBER"],
        compute: function (range, ...args) {
            let uniqueValues = new Set();
            visitMatchingRanges(args, (i, j) => {
                const value = range[i][j];
                if (isDefined(value)) {
                    uniqueValues.add(value);
                }
            });
            return uniqueValues.size;
        },
    };
    // -----------------------------------------------------------------------------
    // CSC
    // -----------------------------------------------------------------------------
    const CSC = {
        description: _lt("Cosecant of an angle provided in radians."),
        args: args(`
    angle (number) ${_lt("The angle to find the cosecant of, in radians.")}
  `),
        returns: ["NUMBER"],
        compute: function (angle) {
            const _angle = toNumber(angle);
            if (_angle === 0) {
                throw new Error(_lt(`Function [[FUNCTION_NAME]] caused a divide by zero error.`));
            }
            return 1 / Math.sin(_angle);
        },
    };
    // -----------------------------------------------------------------------------
    // CSCH
    // -----------------------------------------------------------------------------
    const CSCH = {
        description: _lt("Hyperbolic cosecant of any real number."),
        args: args(`
    value (number) ${_lt("Any real value to calculate the hyperbolic cosecant of.")}
  `),
        returns: ["NUMBER"],
        compute: function (value) {
            const _value = toNumber(value);
            if (_value === 0) {
                throw new Error(_lt(`Function [[FUNCTION_NAME]] caused a divide by zero error.`));
            }
            return 1 / Math.sinh(_value);
        },
    };
    // -----------------------------------------------------------------------------
    // DECIMAL
    // -----------------------------------------------------------------------------
    const decimalErrorParameter2 = (parameterName, base, value) => _lt("Function DECIMAL expects the parameter '%s' to be a valid base %s representation. Change '%s' from [%s] to a valid base %s representation.", parameterName, base, parameterName, value, base);
    const DECIMAL = {
        description: _lt("Converts from another base to decimal."),
        args: args(`
    value (string) ${_lt("The number to convert.")},
    base (number) ${_lt("The base to convert the value from.")},
  `),
        returns: ["NUMBER"],
        compute: function (value, base) {
            let _base = toNumber(base);
            _base = Math.floor(_base);
            if (_base < 2 || _base > 36) {
                throw new Error(_lt("Function DECIMAL expects the parameter '%s' to be between 2 and 36 inclusive. Change '%s' from [%s] to a value between 2 and 36.", DECIMAL.args[1].name, DECIMAL.args[1].name, _base.toString()));
            }
            const _value = toString(value);
            if (_value === "") {
                return 0;
            }
            /**
             * @compatibility: on Google sheets, expects the parameter 'value' to be positive.
             * Return error if 'value' is positive.
             * Remove '-?' in the next regex to catch this error.
             */
            if (!_value.match(/^-?[a-z0-9]+$/i)) {
                throw new Error(decimalErrorParameter2(DECIMAL.args[0].name, _base, _value));
            }
            const deci = parseInt(_value, _base);
            if (isNaN(deci)) {
                throw new Error(decimalErrorParameter2(DECIMAL.args[0].name, _base, _value));
            }
            return deci;
        },
    };
    // -----------------------------------------------------------------------------
    // DEGREES
    // -----------------------------------------------------------------------------
    const DEGREES = {
        description: _lt(`Converts an angle value in radians to degrees.`),
        args: args(`
    angle (number)  ${_lt("The angle to convert from radians to degrees.")}
  `),
        returns: ["NUMBER"],
        compute: function (angle) {
            return (toNumber(angle) * 180) / Math.PI;
        },
    };
    // -----------------------------------------------------------------------------
    // EXP
    // -----------------------------------------------------------------------------
    const EXP = {
        description: _lt(`Euler's number, e (~2.718) raised to a power.`),
        args: args(`
    value (number) ${_lt("The exponent to raise e.")}
  `),
        returns: ["NUMBER"],
        compute: function (value) {
            return Math.exp(toNumber(value));
        },
    };
    // -----------------------------------------------------------------------------
    // FLOOR
    // -----------------------------------------------------------------------------
    const FLOOR = {
        description: _lt(`Rounds number down to nearest multiple of factor.`),
        args: args(`
    value (number) ${_lt("The value to round down to the nearest integer multiple of factor.")}
    factor (number, optional, default=1) ${_lt("The number to whose multiples value will be rounded.")}
  `),
        returns: ["NUMBER"],
        compute: function (value, factor = 1) {
            const _value = toNumber(value);
            const _factor = toNumber(factor);
            if (_value > 0 && _factor < 0) {
                throw new Error(_lt("Function FLOOR expects the parameter '%s' to be positive when parameter '%s' is positive. Change '%s' from [%s] to a positive value.", FLOOR.args[1].name, FLOOR.args[0].name, FLOOR.args[1].name, _factor.toString()));
            }
            return _factor ? Math.floor(_value / _factor) * _factor : 0;
        },
    };
    // -----------------------------------------------------------------------------
    // FLOOR.MATH
    // -----------------------------------------------------------------------------
    const FLOOR_MATH = {
        description: _lt(`Rounds number down to nearest multiple of factor.`),
        args: args(`
    number (number) ${_lt("The value to round down to the nearest integer multiple of significance.")}
    significance (number, optional, default=1) ${_lt("The number to whose multiples number will be rounded. The sign of significance will be ignored.")}
    mode (number, optional, default=0) ${_lt("If number is negative, specifies the rounding direction. If 0 or blank, it is rounded away from zero. Otherwise, it is rounded towards zero.")}
  `),
        returns: ["NUMBER"],
        compute: function (number, significance = 1, mode = 0) {
            let _significance = toNumber(significance);
            if (_significance === 0) {
                return 0;
            }
            const _number = toNumber(number);
            _significance = Math.abs(_significance);
            if (_number >= 0) {
                return Math.floor(_number / _significance) * _significance;
            }
            const _mode = toNumber(mode);
            if (_mode === 0) {
                return -Math.ceil(Math.abs(_number) / _significance) * _significance;
            }
            return -Math.floor(Math.abs(_number) / _significance) * _significance;
        },
    };
    // -----------------------------------------------------------------------------
    // FLOOR.PRECISE
    // -----------------------------------------------------------------------------
    const FLOOR_PRECISE = {
        description: _lt(`Rounds number down to nearest multiple of factor.`),
        args: args(`
    number (number) ${_lt("The value to round down to the nearest integer multiple of significance.")}
    significance (number, optional, default=1) ${_lt("The number to whose multiples number will be rounded.")}
  `),
        returns: ["NUMBER"],
        compute: function (number, significance = 1) {
            return FLOOR_MATH.compute(number, significance, 0);
        },
    };
    // -----------------------------------------------------------------------------
    // ISEVEN
    // -----------------------------------------------------------------------------
    const ISEVEN = {
        description: _lt(`Whether the provided value is even.`),
        args: args(`
    value (number) ${_lt("The value to be verified as even.")}
  `),
        returns: ["BOOLEAN"],
        compute: function (value) {
            const _value = strictToNumber(value);
            return Math.floor(Math.abs(_value)) & 1 ? false : true;
        },
    };
    // -----------------------------------------------------------------------------
    // ISO.CEILING
    // -----------------------------------------------------------------------------
    const ISO_CEILING = {
        description: _lt(`Rounds number up to nearest multiple of factor.`),
        args: args(`
      number (number) ${_lt("The value to round up to the nearest integer multiple of significance.")}
      significance (number, optional, default=1) ${_lt("The number to whose multiples number will be rounded.")}
    `),
        returns: ["NUMBER"],
        compute: function (number, significance) {
            return CEILING_MATH.compute(number, significance, 0);
        },
    };
    // -----------------------------------------------------------------------------
    // ISODD
    // -----------------------------------------------------------------------------
    const ISODD = {
        description: _lt(`Whether the provided value is even.`),
        args: args(`
    value (number) ${_lt("The value to be verified as even.")}
  `),
        returns: ["BOOLEAN"],
        compute: function (value) {
            const _value = strictToNumber(value);
            return Math.floor(Math.abs(_value)) & 1 ? true : false;
        },
    };
    // -----------------------------------------------------------------------------
    // LN
    // -----------------------------------------------------------------------------
    const LN = {
        description: _lt(`The logarithm of a number, base e (euler's number).`),
        args: args(`
    value (number) ${_lt("The value for which to calculate the logarithm, base e.")}
  `),
        returns: ["NUMBER"],
        compute: function (value) {
            const _value = toNumber(value);
            if (_value <= 0) {
                throw new Error(_lt("Function [[FUNCTION_NAME]] parameter 1 value is %s. It should be greater than 0.", _value.toString()));
            }
            return Math.log(_value);
        },
    };
    // -----------------------------------------------------------------------------
    // MOD
    // -----------------------------------------------------------------------------
    const MOD = {
        description: _lt(`Modulo (remainder) operator.`),
        args: args(`
      dividend (number) ${_lt("The number to be divided to find the remainder.")}
      divisor (number) ${_lt("The number to divide by.")}
    `),
        returns: ["NUMBER"],
        compute: function (dividend, divisor) {
            const _divisor = toNumber(divisor);
            if (_divisor === 0) {
                throw new Error(_lt("Function MOD expects the parameter '%s' to be different from 0. Change '%s' to a value other than 0.", MOD.args[1].name, MOD.args[1].name));
            }
            const _dividend = toNumber(dividend);
            const modulus = _dividend % _divisor;
            // -42 % 10 = -2 but we want 8, so need the code below
            if ((modulus > 0 && _divisor < 0) || (modulus < 0 && _divisor > 0)) {
                return modulus + _divisor;
            }
            return modulus;
        },
    };
    // -----------------------------------------------------------------------------
    // ODD
    // -----------------------------------------------------------------------------
    const ODD = {
        description: _lt(`Rounds a number up to the nearest odd integer.`),
        args: args(`
      value (number) ${_lt("The value to round to the next greatest odd number.")}
    `),
        returns: ["NUMBER"],
        compute: function (value) {
            const _value = toNumber(value);
            let temp = Math.ceil(Math.abs(_value));
            temp = temp & 1 ? temp : temp + 1;
            return _value < 0 ? -temp : temp;
        },
    };
    // -----------------------------------------------------------------------------
    // PI
    // -----------------------------------------------------------------------------
    const PI = {
        description: _lt(`The number pi.`),
        args: [],
        returns: ["NUMBER"],
        compute: function () {
            return Math.PI;
        },
    };
    // -----------------------------------------------------------------------------
    // POWER
    // -----------------------------------------------------------------------------
    const POWER = {
        description: _lt(`A number raised to a power.`),
        args: args(`
      base (number) ${_lt("The number to raise to the exponent power.")}
      exponent (number) ${_lt("The exponent to raise base to.")}
    `),
        returns: ["NUMBER"],
        compute: function (base, exponent) {
            const _base = toNumber(base);
            const _exponent = toNumber(exponent);
            if (_base >= 0) {
                return Math.pow(_base, _exponent);
            }
            if (!Number.isInteger(_exponent)) {
                throw new Error(_lt("Function POWER expects the parameter '%s' to be an integer when parameter '%s' is negative. Change '%s' from [%s] to an integer value.", POWER.args[1].name, POWER.args[0].name, POWER.args[1].name, _exponent.toString()));
            }
            return Math.pow(_base, _exponent);
        },
    };
    // -----------------------------------------------------------------------------
    // PRODUCT
    // -----------------------------------------------------------------------------
    const PRODUCT = {
        description: _lt("Result of multiplying a series of numbers together."),
        args: args(`
      factor1 (number, range<number>) ${_lt("The first number or range to calculate for the product.")}
      factor2 (number, range<number>, optional, repeating) ${_lt("More numbers or ranges to calculate for the product.")}
    `),
        returns: ["NUMBER"],
        compute: function () {
            let count = 0;
            let acc = 1;
            for (let n of arguments) {
                if (Array.isArray(n)) {
                    for (let i of n) {
                        for (let j of i) {
                            if (typeof j === "number") {
                                acc *= j;
                                count += 1;
                            }
                        }
                    }
                }
                else if (n !== null) {
                    acc *= strictToNumber(n);
                    count += 1;
                }
            }
            if (count === 0) {
                return 0;
            }
            return acc;
        },
    };
    // -----------------------------------------------------------------------------
    // RAND
    // -----------------------------------------------------------------------------
    const RAND = {
        description: _lt("A random number between 0 inclusive and 1 exclusive."),
        args: [],
        returns: ["NUMBER"],
        compute: function () {
            return Math.random();
        },
    };
    // -----------------------------------------------------------------------------
    // RANDBETWEEN
    // -----------------------------------------------------------------------------
    const RANDBETWEEN = {
        description: _lt("Random integer between two values, inclusive."),
        args: args(`
      low (number) ${_lt("The low end of the random range.")}
      high (number) ${_lt("The high end of the random range.")}
    `),
        returns: ["NUMBER"],
        compute: function (low, high) {
            let _low = toNumber(low);
            if (!Number.isInteger(_low)) {
                _low = Math.ceil(_low);
            }
            let _high = toNumber(high);
            if (!Number.isInteger(_high)) {
                _high = Math.floor(_high);
            }
            if (_high < _low) {
                throw new Error(_lt("Function RANDBETWEEN parameter '%s' value is %s. It should be greater than or equal to [%s].", RANDBETWEEN.args[1].name, _high.toString(), _low.toString()));
            }
            return _low + Math.ceil((_high - _low + 1) * Math.random()) - 1;
        },
    };
    // -----------------------------------------------------------------------------
    // ROUND
    // -----------------------------------------------------------------------------
    const ROUND = {
        description: _lt("Rounds a number according to standard rules."),
        args: args(`
      value (number) ${_lt("The value to round to places number of places.")}
      places (number, optional, default=0) ${_lt("The number of decimal places to which to round.")}
    `),
        returns: ["NUMBER"],
        compute: function (value, places = 0) {
            const _value = toNumber(value);
            let _places = toNumber(places);
            const absValue = Math.abs(_value);
            let tempResult;
            if (_places === 0) {
                tempResult = Math.round(absValue);
            }
            else {
                if (!Number.isInteger(_places)) {
                    _places = Math.trunc(_places);
                }
                tempResult = Math.round(absValue * Math.pow(10, _places)) / Math.pow(10, _places);
            }
            return _value >= 0 ? tempResult : -tempResult;
        },
    };
    // -----------------------------------------------------------------------------
    // ROUNDDOWN
    // -----------------------------------------------------------------------------
    const ROUNDDOWN = {
        description: _lt(`Rounds down a number.`),
        args: args(`
      value (number) ${_lt("The value to round to places number of places, always rounding down.")}
      places (number, optional, default=0) ${_lt("The number of decimal places to which to round.")}
    `),
        returns: ["NUMBER"],
        compute: function (value, places = 0) {
            const _value = toNumber(value);
            let _places = toNumber(places);
            const absValue = Math.abs(_value);
            let tempResult;
            if (_places === 0) {
                tempResult = Math.floor(absValue);
            }
            else {
                if (!Number.isInteger(_places)) {
                    _places = Math.trunc(_places);
                }
                tempResult = Math.floor(absValue * Math.pow(10, _places)) / Math.pow(10, _places);
            }
            return _value >= 0 ? tempResult : -tempResult;
        },
    };
    // -----------------------------------------------------------------------------
    // ROUNDUP
    // -----------------------------------------------------------------------------
    const ROUNDUP = {
        description: _lt(`Rounds up a number.`),
        args: args(`
      value (number) ${_lt("The value to round to places number of places, always rounding up.")}
      places (number, optional, default=0) ${_lt("The number of decimal places to which to round.")}
    `),
        returns: ["NUMBER"],
        compute: function (value, places) {
            const _value = toNumber(value);
            let _places = toNumber(places);
            const absValue = Math.abs(_value);
            let tempResult;
            if (_places === 0) {
                tempResult = Math.ceil(absValue);
            }
            else {
                if (!Number.isInteger(_places)) {
                    _places = Math.trunc(_places);
                }
                tempResult = Math.ceil(absValue * Math.pow(10, _places)) / Math.pow(10, _places);
            }
            return _value >= 0 ? tempResult : -tempResult;
        },
    };
    // -----------------------------------------------------------------------------
    // SEC
    // -----------------------------------------------------------------------------
    const SEC = {
        description: _lt("Secant of an angle provided in radians."),
        args: args(`
    angle (number) ${_lt("The angle to find the secant of, in radians.")}
  `),
        returns: ["NUMBER"],
        compute: function (angle) {
            return 1 / Math.cos(toNumber(angle));
        },
    };
    // -----------------------------------------------------------------------------
    // SECH
    // -----------------------------------------------------------------------------
    const SECH = {
        description: _lt("Hyperbolic secant of any real number."),
        args: args(`
    value (number) ${_lt("Any real value to calculate the hyperbolic secant of.")}
  `),
        returns: ["NUMBER"],
        compute: function (value) {
            return 1 / Math.cosh(toNumber(value));
        },
    };
    // -----------------------------------------------------------------------------
    // SIN
    // -----------------------------------------------------------------------------
    const SIN = {
        description: _lt("Sine of an angle provided in radians."),
        args: args(`
      angle (number) ${_lt("The angle to find the sine of, in radians.")}
    `),
        returns: ["NUMBER"],
        compute: function (angle) {
            return Math.sin(toNumber(angle));
        },
    };
    // -----------------------------------------------------------------------------
    // SINH
    // -----------------------------------------------------------------------------
    const SINH = {
        description: _lt("Hyperbolic sine of any real number."),
        args: args(`
    value (number) ${_lt("Any real value to calculate the hyperbolic sine of.")}
  `),
        returns: ["NUMBER"],
        compute: function (value) {
            return Math.sinh(toNumber(value));
        },
    };
    // -----------------------------------------------------------------------------
    // SQRT
    // -----------------------------------------------------------------------------
    const SQRT = {
        description: _lt("Positive square root of a positive number."),
        args: args(`
      value (number) ${_lt("The number for which to calculate the positive square root.")}
    `),
        returns: ["NUMBER"],
        compute: function (value) {
            const _value = toNumber(value);
            if (_value < 0) {
                throw new Error(_lt("Function SQRT parameter '%s' value is negative. It should be positive or zero. Change '%s' from [%s] to a positive value.", SQRT.args[0].name, SQRT.args[0].name, _value.toString()));
            }
            return Math.sqrt(_value);
        },
    };
    // -----------------------------------------------------------------------------
    // SUM
    // -----------------------------------------------------------------------------
    const SUM = {
        description: _lt("Sum of a series of numbers and/or cells."),
        args: args(`
      value1 (number, range<number>) ${_lt("The first number or range to add together.")}
      value2 (number, range<number>, optional, repeating) ${_lt("Additional numbers or ranges to add to value1.")}
    `),
        returns: ["NUMBER"],
        compute: function () {
            return reduceNumbers(arguments, (acc, a) => acc + a, 0);
        },
    };
    // -----------------------------------------------------------------------------
    // SUMIF
    // -----------------------------------------------------------------------------
    const SUMIF = {
        description: _lt("A conditional sum across a range."),
        args: args(`
      criteria_range (range) ${_lt("The range which is tested against criterion.")}
      criterion (string) ${_lt("The pattern or test to apply to range.")}
      sum_range (range, optional, default=criteria_range) ${_lt("The range to be summed, if different from range.")}
    `),
        returns: ["NUMBER"],
        compute: function (criteria_range, criterion, sum_range = undefined) {
            if (sum_range === undefined) {
                sum_range = criteria_range;
            }
            let sum = 0;
            visitMatchingRanges([criteria_range, criterion], (i, j) => {
                const value = sum_range[i][j];
                if (typeof value === "number") {
                    sum += value;
                }
            });
            return sum;
        },
    };
    // -----------------------------------------------------------------------------
    // SUMIFS
    // -----------------------------------------------------------------------------
    const SUMIFS = {
        description: _lt("Sums a range depending on multiple criteria."),
        args: args(`
      sum_range (range) ${_lt("The range to sum.")}
      criteria_range1 (range) ${_lt("The range to check against criterion1.")}
      criterion1 (string) ${_lt("The pattern or test to apply to criteria_range1.")}
      additional_values (any, range, optional, repeating) ${_lt("Additional criteria_range and criterion to check.")}
    `),
        // @compatibility: on google sheets, args definitions are next:
        // sum_range (any, range) The range to sum.
        // criteria_range1 (any, range) The range to check against criterion1.
        // criterion1 (string) The pattern or test to apply to criteria_range1.
        // criteria_range2 (any, range, optional, repeating) Additional ranges to check.
        // criterion2 (string, optional, repeating) Additional criteria to check.
        returns: ["NUMBER"],
        compute: function (sum_range, ...args) {
            let sum = 0;
            visitMatchingRanges(args, (i, j) => {
                const value = sum_range[i][j];
                if (typeof value === "number") {
                    sum += value;
                }
            });
            return sum;
        },
    };
    // -----------------------------------------------------------------------------
    // TAN
    // -----------------------------------------------------------------------------
    const TAN = {
        description: _lt("Tangent of an angle provided in radians."),
        args: args(`
    angle (number) ${_lt("The angle to find the tangent of, in radians.")}
  `),
        returns: ["NUMBER"],
        compute: function (angle) {
            return Math.tan(toNumber(angle));
        },
    };
    // -----------------------------------------------------------------------------
    // TANH
    // -----------------------------------------------------------------------------
    const TANH = {
        description: _lt("Hyperbolic tangent of any real number."),
        args: args(`
    value (number) ${_lt("Any real value to calculate the hyperbolic tangent of.")}
  `),
        returns: ["NUMBER"],
        compute: function (value) {
            return Math.tanh(toNumber(value));
        },
    };
    // -----------------------------------------------------------------------------
    // TRUNC
    // -----------------------------------------------------------------------------
    const TRUNC = {
        description: _lt("Truncates a number."),
        args: args(`
      value (number) ${_lt("The value to be truncated.")}
      places (number, optional, default=0) ${_lt("The number of significant digits to the right of the decimal point to retain.")}
    `),
        returns: ["NUMBER"],
        compute: function (value, places = 0) {
            const _value = toNumber(value);
            let _places = toNumber(places);
            if (_places === 0) {
                return Math.trunc(_value);
            }
            if (!Number.isInteger(_places)) {
                _places = Math.trunc(_places);
            }
            return Math.trunc(_value * Math.pow(10, _places)) / Math.pow(10, _places);
        },
    };

    var math = /*#__PURE__*/Object.freeze({
        __proto__: null,
        ACOS: ACOS,
        ACOSH: ACOSH,
        ACOT: ACOT,
        ACOTH: ACOTH,
        ASIN: ASIN,
        ASINH: ASINH,
        ATAN: ATAN,
        ATAN2: ATAN2,
        ATANH: ATANH,
        CEILING: CEILING,
        CEILING_MATH: CEILING_MATH,
        CEILING_PRECISE: CEILING_PRECISE,
        COS: COS,
        COSH: COSH,
        COT: COT,
        COTH: COTH,
        COUNTBLANK: COUNTBLANK,
        COUNTIF: COUNTIF,
        COUNTIFS: COUNTIFS,
        COUNTUNIQUE: COUNTUNIQUE,
        COUNTUNIQUEIFS: COUNTUNIQUEIFS,
        CSC: CSC,
        CSCH: CSCH,
        DECIMAL: DECIMAL,
        DEGREES: DEGREES,
        EXP: EXP,
        FLOOR: FLOOR,
        FLOOR_MATH: FLOOR_MATH,
        FLOOR_PRECISE: FLOOR_PRECISE,
        ISEVEN: ISEVEN,
        ISO_CEILING: ISO_CEILING,
        ISODD: ISODD,
        LN: LN,
        MOD: MOD,
        ODD: ODD,
        PI: PI,
        POWER: POWER,
        PRODUCT: PRODUCT,
        RAND: RAND,
        RANDBETWEEN: RANDBETWEEN,
        ROUND: ROUND,
        ROUNDDOWN: ROUNDDOWN,
        ROUNDUP: ROUNDUP,
        SEC: SEC,
        SECH: SECH,
        SIN: SIN,
        SINH: SINH,
        SQRT: SQRT,
        SUM: SUM,
        SUMIF: SUMIF,
        SUMIFS: SUMIFS,
        TAN: TAN,
        TANH: TANH,
        TRUNC: TRUNC
    });

    // Note: dataY and dataX may not have the same dimension
    function covariance(dataY, dataX, isSample) {
        let flatDataY = [];
        let flatDataX = [];
        let lenY = 0;
        let lenX = 0;
        visitAny(dataY, (y) => {
            flatDataY.push(y);
            lenY += 1;
        });
        visitAny(dataX, (x) => {
            flatDataX.push(x);
            lenX += 1;
        });
        if (lenY !== lenX) {
            throw new Error(_lt("[[FUNCTION_NAME]] has mismatched argument count %s vs %s.", lenY.toString(), lenX.toString()));
        }
        let count = 0;
        let sumY = 0;
        let sumX = 0;
        for (let i = 0; i < lenY; i++) {
            const valueY = flatDataY[i];
            const valueX = flatDataX[i];
            if (typeof valueY === "number" && typeof valueX === "number") {
                count += 1;
                sumY += valueY;
                sumX += valueX;
            }
        }
        if (count === 0 || (isSample && count === 1)) {
            throw new Error(_lt(`Evaluation of function [[FUNCTION_NAME]] caused a divide by zero error.`));
        }
        const averageY = sumY / count;
        const averageX = sumX / count;
        let acc = 0;
        for (let i = 0; i < lenY; i++) {
            const valueY = flatDataY[i];
            const valueX = flatDataX[i];
            if (typeof valueY === "number" && typeof valueX === "number") {
                acc += (valueY - averageY) * (valueX - averageX);
            }
        }
        return acc / (count - (isSample ? 1 : 0));
    }
    function variance(args, isSample, textAs0) {
        let count = 0;
        let sum = 0;
        const reduceFuction = textAs0 ? reduceNumbersTextAs0 : reduceNumbers;
        sum = reduceFuction(args, (acc, a) => {
            count += 1;
            return acc + a;
        }, 0);
        if (count === 0 || (isSample && count === 1)) {
            throw new Error(_lt(`Evaluation of function [[FUNCTION_NAME]] caused a divide by zero error.`));
        }
        const average = sum / count;
        return (reduceFuction(args, (acc, a) => acc + Math.pow(a - average, 2), 0) /
            (count - (isSample ? 1 : 0)));
    }
    // -----------------------------------------------------------------------------
    // AVEDEV
    // -----------------------------------------------------------------------------
    const AVEDEV = {
        description: _lt("Average magnitude of deviations from mean."),
        args: args(`
    value1 (number, range<number>) ${_lt("The first value or range of the sample.")}
    value2 (number, range<number>, optional, repeating) ${_lt("Additional values or ranges to include in the sample.")}
  `),
        returns: ["NUMBER"],
        compute: function () {
            let count = 0;
            const sum = reduceNumbers(arguments, (acc, a) => {
                count += 1;
                return acc + a;
            }, 0);
            if (count === 0) {
                throw new Error(_lt(`Evaluation of function AVEDEV caused a divide by zero error.`));
            }
            const average = sum / count;
            return reduceNumbers(arguments, (acc, a) => acc + Math.abs(average - a), 0) / count;
        },
    };
    // -----------------------------------------------------------------------------
    // AVERAGE
    // -----------------------------------------------------------------------------
    const AVERAGE = {
        description: _lt(`Numerical average value in a dataset, ignoring text.`),
        args: args(`
      value1 (number, range<number>) ${_lt("The first value or range to consider when calculating the average value.")}
      value2 (number, range<number>, optional, repeating) ${_lt("Additional values or ranges to consider when calculating the average value.")}
    `),
        returns: ["NUMBER"],
        compute: function () {
            let count = 0;
            const sum = reduceNumbers(arguments, (acc, a) => {
                count += 1;
                return acc + a;
            }, 0);
            if (count === 0) {
                throw new Error(_lt(`Evaluation of function AVERAGE caused a divide by zero error.`));
            }
            return sum / count;
        },
    };
    // -----------------------------------------------------------------------------
    // AVERAGE.WEIGHTED
    // -----------------------------------------------------------------------------
    const rangeError = _lt(`AVERAGE.WEIGHTED has mismatched range sizes.`);
    const negativeWeightError = _lt(`AVERAGE.WEIGHTED expects the weight to be positive or equal to 0.`);
    const AVERAGE_WEIGHTED = {
        description: _lt(`Weighted average.`),
        args: args(`
      values (number, range<number>) ${_lt("Values to average.")}
      weights (number, range<number>) ${_lt("Weights for each corresponding value.")}
      additional_values (number, range<number>, optional, repeating) ${_lt("Additional values to average with weights.")}
    `),
        // @compatibility: on google sheets, args difinitions are next:
        // additional_values (number, range<number>, optional, repeating) Additional values to average.
        // additional_weights (number, range<number>, optional, repeating) Additional weights.
        returns: ["NUMBER"],
        compute: function () {
            let sum = 0;
            let count = 0;
            let value;
            let weight;
            if (arguments.length % 2 === 1) {
                throw new Error(_lt(`Wrong number of arguments. Expected an even number of arguments.`));
            }
            for (let n = 0; n < arguments.length - 1; n += 2) {
                value = arguments[n];
                weight = arguments[n + 1];
                // if (typeof value != typeof weight) {
                //   throw new Error(rangeError);
                // }
                if (Array.isArray(value)) {
                    if (!Array.isArray(weight)) {
                        throw new Error(rangeError);
                    }
                    let dimColValue = value.length;
                    let dimLinValue = value[0].length;
                    if (dimColValue !== weight.length || dimLinValue != weight[0].length) {
                        throw new Error(rangeError);
                    }
                    for (let i = 0; i < dimColValue; i++) {
                        for (let j = 0; j < dimLinValue; j++) {
                            let subValue = value[i][j];
                            let subWeight = weight[i][j];
                            let subValueIsNumber = typeof subValue === "number";
                            let subWeightIsNumber = typeof subWeight === "number";
                            // typeof subValue or subWeight can be 'number' or 'undefined'
                            if (subValueIsNumber !== subWeightIsNumber) {
                                throw new Error(_lt(`AVERAGE.WEIGHTED expects number values.`));
                            }
                            if (subWeightIsNumber) {
                                if (subWeight < 0) {
                                    throw new Error(negativeWeightError);
                                }
                                sum += subValue * subWeight;
                                count += subWeight;
                            }
                        }
                    }
                }
                else {
                    weight = toNumber(weight);
                    value = toNumber(value);
                    if (weight < 0) {
                        throw new Error(negativeWeightError);
                    }
                    sum += value * weight;
                    count += weight;
                }
            }
            if (count === 0) {
                throw new Error(_lt(`Evaluation of function AVERAGE.WEIGHTED caused a divide by zero error.`));
            }
            return sum / count;
        },
    };
    // -----------------------------------------------------------------------------
    // AVERAGEA
    // -----------------------------------------------------------------------------
    const AVERAGEA = {
        description: _lt(`Numerical average value in a dataset.`),
        args: args(`
      value1 (number, range<number>) ${_lt("The first value or range to consider when calculating the average value.")}
      value2 (number, range<number>, optional, repeating) ${_lt("Additional values or ranges to consider when calculating the average value.")}
    `),
        returns: ["NUMBER"],
        compute: function () {
            let count = 0;
            const sum = reduceNumbersTextAs0(arguments, (acc, a) => {
                count += 1;
                return acc + a;
            }, 0);
            if (count === 0) {
                throw new Error(_lt(`Evaluation of function AVERAGEA caused a divide by zero error.`));
            }
            return sum / count;
        },
    };
    // -----------------------------------------------------------------------------
    // AVERAGEIF
    // -----------------------------------------------------------------------------
    const AVERAGEIF = {
        description: _lt(`Average of values depending on criteria.`),
        args: args(`
      criteria_range (range) ${_lt("The range to check against criterion.")}
      criterion (string) ${_lt("The pattern or test to apply to criteria_range.")}
      average_range (range, optional, default=criteria_range) ${_lt("The range to average. If not included, criteria_range is used for the average instead.")}
    `),
        returns: ["NUMBER"],
        compute: function (criteria_range, criterion, average_range = undefined) {
            if (average_range === undefined) {
                average_range = criteria_range;
            }
            let count = 0;
            let sum = 0;
            visitMatchingRanges([criteria_range, criterion], (i, j) => {
                const value = average_range[i][j];
                if (typeof value === "number") {
                    count += 1;
                    sum += value;
                }
            });
            if (count === 0) {
                throw new Error(_lt(`Evaluation of function AVERAGEIF caused a divide by zero error.`));
            }
            return sum / count;
        },
    };
    // -----------------------------------------------------------------------------
    // AVERAGEIFS
    // -----------------------------------------------------------------------------
    const AVERAGEIFS = {
        description: _lt(`Average of values depending on multiple criteria.`),
        args: args(`
      average_range (range) ${_lt("The range to average.")}
      criteria_range1 (range) ${_lt("The range to check against criterion1.")}
      criterion1 (string) ${_lt("The pattern or test to apply to criteria_range1.")}
      additional_values (any, range, optional, repeating) ${_lt("Additional criteria_range and criterion to check.")}
    `),
        // @compatibility: on google sheets, args definitions are next:
        // average_range (any, range) The range to average.
        // criteria_range1 (any, range) The range to check against criterion1.
        // criterion1 (string) The pattern or test to apply to criteria_range1.
        // criteria_range2 (any, range, optional, repeating) Additional ranges to check.
        // criterion2 (string, optional, repeating) Additional criteria to check.
        returns: ["NUMBER"],
        compute: function (average_range, ...args) {
            let count = 0;
            let sum = 0;
            visitMatchingRanges(args, (i, j) => {
                const value = average_range[i][j];
                if (typeof value === "number") {
                    count += 1;
                    sum += value;
                }
            });
            if (count === 0) {
                throw new Error(_lt(`Evaluation of function AVERAGEIFS caused a divide by zero error.`));
            }
            return sum / count;
        },
    };
    // -----------------------------------------------------------------------------
    // COUNT
    // -----------------------------------------------------------------------------
    const COUNT = {
        description: _lt(`The number of numeric values in dataset.`),
        args: args(`
    value1 (number, range<number>) ${_lt("The first value or range to consider when counting.")}
    value2 (number, range<number>, optional, repeating) ${_lt("Additional values or ranges to consider when counting.")}
  `),
        returns: ["NUMBER"],
        compute: function () {
            let count = 0;
            for (let n of arguments) {
                if (Array.isArray(n)) {
                    for (let i of n) {
                        for (let j of i) {
                            if (typeof j === "number" || (typeof j === "object" && j !== null && j.jsDate)) {
                                count += 1;
                            }
                        }
                    }
                }
                else if (typeof n !== "string" || isNumber(n) || parseDateTime(n)) {
                    count += 1;
                }
            }
            return count;
        },
    };
    // -----------------------------------------------------------------------------
    // COUNTA
    // -----------------------------------------------------------------------------
    const COUNTA = {
        description: _lt(`The number of values in a dataset.`),
        args: args(`
    value1 (any, range) ${_lt("The first value or range to consider when counting.")}
    value2 (any, range, optional, repeating) ${_lt("Additional values or ranges to consider when counting.")}
  `),
        returns: ["NUMBER"],
        compute: function () {
            return reduceArgs(arguments, (acc, a) => (a !== undefined && a !== null ? acc + 1 : acc), 0);
        },
    };
    // -----------------------------------------------------------------------------
    // COVAR
    // -----------------------------------------------------------------------------
    // Note: Unlike the VAR function which corresponds to the variance over a sample (VAR.S),
    // the COVAR function corresponds to the covariance over an entire population (COVAR.P)
    const COVAR = {
        description: _lt(`The covariance of a dataset.`),
        args: args(`
    data_y (any, range) ${_lt("The range representing the array or matrix of dependent data.")}
    data_x (any, range) ${_lt("The range representing the array or matrix of independent data.")}
  `),
        returns: ["NUMBER"],
        compute: function (data_y, data_x) {
            return covariance(data_y, data_x, false);
        },
    };
    // -----------------------------------------------------------------------------
    // COVARIANCE.P
    // -----------------------------------------------------------------------------
    const COVARIANCE_P = {
        description: _lt(`The covariance of a dataset.`),
        args: args(`
    data_y (any, range) ${_lt("The range representing the array or matrix of dependent data.")}
    data_x (any, range) ${_lt("The range representing the array or matrix of independent data.")}
  `),
        returns: ["NUMBER"],
        compute: function (data_y, data_x) {
            return covariance(data_y, data_x, false);
        },
    };
    // -----------------------------------------------------------------------------
    // COVARIANCE.S
    // -----------------------------------------------------------------------------
    const COVARIANCE_S = {
        description: _lt(`The sample covariance of a dataset.`),
        args: args(`
    data_y (any, range) ${_lt("The range representing the array or matrix of dependent data.")}
    data_x (any, range) ${_lt("The range representing the array or matrix of independent data.")}
  `),
        returns: ["NUMBER"],
        compute: function (data_y, data_x) {
            return covariance(data_y, data_x, true);
        },
    };
    // -----------------------------------------------------------------------------
    // LARGE
    // -----------------------------------------------------------------------------
    const LARGE = {
        description: _lt("Nth largest element from a data set."),
        args: args(`
      data (any, range) ${_lt("Array or range containing the dataset to consider.")}
      n (number) ${_lt("The rank from largest to smallest of the element to return.")}
    `),
        returns: ["NUMBER"],
        compute: function (data, n) {
            n = Math.trunc(toNumber(n));
            let largests = [];
            let index;
            let count = 0;
            visitAny(data, (d) => {
                d = extractDateValue(d);
                if (typeof d === "number") {
                    index = dichotomicPredecessorSearch(largests, d);
                    largests.splice(index + 1, 0, d);
                    count++;
                    if (count > n) {
                        largests.shift();
                        count--;
                    }
                }
            });
            const result = largests.shift();
            if (result === undefined) {
                throw new Error(_lt(`LARGE has no valid input data.`));
            }
            if (count < n) {
                throw new Error(_lt("Function LARGE parameter 2 value %s is out of range.", n.toString()));
            }
            return result;
        },
    };
    // -----------------------------------------------------------------------------
    // MAX
    // -----------------------------------------------------------------------------
    const MAX = {
        description: _lt("Maximum value in a numeric dataset."),
        args: args(`
      value1 (number, range<number>) ${_lt("The first value or range to consider when calculating the maximum value.")}
      value2 (number, range<number>, optional, repeating) ${_lt("Additional values or ranges to consider when calculating the maximum value.")}
    `),
        returns: ["NUMBER"],
        compute: function () {
            const result = reduceNumbers(arguments, (acc, a) => (acc < a ? a : acc), -Infinity);
            return result === -Infinity ? 0 : result;
        },
    };
    // -----------------------------------------------------------------------------
    // MAXA
    // -----------------------------------------------------------------------------
    const MAXA = {
        description: _lt("Maximum numeric value in a dataset."),
        args: args(`
      value1 (any, range) ${_lt("The first value or range to consider when calculating the maximum value.")}
      value2 (any, range, optional, repeating) ${_lt("Additional values or ranges to consider when calculating the maximum value.")}
    `),
        returns: ["NUMBER"],
        compute: function () {
            const maxa = reduceNumbersTextAs0(arguments, (acc, a) => {
                return Math.max(a, acc);
            }, -Infinity);
            return maxa === -Infinity ? 0 : maxa;
        },
    };
    // -----------------------------------------------------------------------------
    // MAXIFS
    // -----------------------------------------------------------------------------
    const MAXIFS = {
        description: _lt("Returns the maximum value in a range of cells, filtered by a set of criteria."),
        args: args(`
      range (range) ${_lt("The range of cells from which the maximum will be determined.")}
      criteria_range1 (range) ${_lt("The range of cells over which to evaluate criterion1.")}
      criterion1 (string) ${_lt("The pattern or test to apply to criteria_range1, such that each cell that evaluates to TRUE will be included in the filtered set.")}
      additional_values (any, range, optional, repeating) ${_lt("Additional criteria_range and criterion to check.")}
    `),
        // @compatibility: on google sheets, args definitions are next:
        // range (any, range) The range of cells from which the maximum will be determined.
        // criteria_range1 (any, range) The range of cells over which to evaluate criterion1.
        // criterion1 (string) The pattern or test to apply to criteria_range1, such that each cell that evaluates to TRUE will be included in the filtered set.
        // criteria_range2 (any, range, optional, repeating) Additional ranges over which to evaluate the additional criteria. The filtered set will be the intersection of the sets produced by each criterion-range pair.
        // criterion2 (string, optional, repeating) The pattern or test to apply to criteria_range2.
        returns: ["NUMBER"],
        compute: function (range, ...args) {
            let result = -Infinity;
            visitMatchingRanges(args, (i, j) => {
                const value = range[i][j];
                if (typeof value === "number") {
                    result = result < value ? value : result;
                }
            });
            return result === -Infinity ? 0 : result;
        },
    };
    // -----------------------------------------------------------------------------
    // MIN
    // -----------------------------------------------------------------------------
    const MIN = {
        description: _lt("Minimum value in a numeric dataset."),
        args: args(`
      value1 (number, range<number>) ${_lt("The first value or range to consider when calculating the minimum value.")}
      value2 (number, range<number>, optional, repeating) ${_lt("Additional values or ranges to consider when calculating the minimum value.")}
    `),
        returns: ["NUMBER"],
        compute: function () {
            const result = reduceNumbers(arguments, (acc, a) => (a < acc ? a : acc), Infinity);
            return result === Infinity ? 0 : result;
        },
    };
    // -----------------------------------------------------------------------------
    // MINA
    // -----------------------------------------------------------------------------
    const MINA = {
        description: _lt("Minimum numeric value in a dataset."),
        args: args(`
      value1 (number, range<number>) ${_lt("The first value or range to consider when calculating the minimum value.")}
      value2 (number, range<number>, optional, repeating) ${_lt("Additional values or ranges to consider when calculating the minimum value.")}
    `),
        returns: ["NUMBER"],
        compute: function () {
            const mina = reduceNumbersTextAs0(arguments, (acc, a) => {
                return Math.min(a, acc);
            }, Infinity);
            return mina === Infinity ? 0 : mina;
        },
    };
    // -----------------------------------------------------------------------------
    // MINIFS
    // -----------------------------------------------------------------------------
    const MINIFS = {
        description: _lt("Returns the minimum value in a range of cells, filtered by a set of criteria."),
        args: args(`
      range (range) ${_lt("The range of cells from which the minimum will be determined.")}
      criteria_range1 (range) ${_lt("The range of cells over which to evaluate criterion1.")}
      criterion1 (string) ${_lt("The pattern or test to apply to criteria_range1, such that each cell that evaluates to TRUE will be included in the filtered set.")}
      additional_values (any, range, optional, repeating) ${_lt("Additional criteria_range and criterion to check.")}
    `),
        // @compatibility: on google sheets, args definitions are next:
        // range (any, range) The range of cells from which the minimum will be determined.
        // criteria_range1 (any, range) The range of cells over which to evaluate criterion1.
        // criterion1 (string) The pattern or test to apply to criteria_range1, such that each cell that evaluates to TRUE will be included in the filtered set.
        // criteria_range2 (any, range, optional, repeating) Additional ranges over which to evaluate the additional criteria. The filtered set will be the intersection of the sets produced by each criterion-range pair.
        // criterion2 (string, optional, repeating) The pattern or test to apply to criteria_range2.
        returns: ["NUMBER"],
        compute: function (range, ...args) {
            let result = Infinity;
            visitMatchingRanges(args, (i, j) => {
                const value = range[i][j];
                if (typeof value === "number") {
                    result = result > value ? value : result;
                }
            });
            return result === Infinity ? 0 : result;
        },
    };
    // -----------------------------------------------------------------------------
    // SMALL
    // -----------------------------------------------------------------------------
    const SMALL = {
        description: _lt("Nth smallest element in a data set."),
        args: args(`
      data (any, range) ${_lt("The array or range containing the dataset to consider.")}
      n (number) ${_lt("The rank from smallest to largest of the element to return.")}
    `),
        returns: ["NUMBER"],
        compute: function (data, n) {
            n = Math.trunc(toNumber(n));
            let largests = [];
            let index;
            let count = 0;
            visitAny(data, (d) => {
                d = extractDateValue(d);
                if (typeof d === "number") {
                    index = dichotomicPredecessorSearch(largests, d);
                    largests.splice(index + 1, 0, d);
                    count++;
                    if (count > n) {
                        largests.pop();
                        count--;
                    }
                }
            });
            const result = largests.pop();
            if (result === undefined) {
                throw new Error(_lt(`SMALL has no valid input data.`));
            }
            if (count < n) {
                throw new Error(_lt("Function SMALL parameter 2 value %s is out of range.", n.toString()));
            }
            return result;
        },
    };
    // -----------------------------------------------------------------------------
    // STDEV
    // -----------------------------------------------------------------------------
    const STDEV = {
        description: _lt("Standard deviation."),
        args: args(`
      value1 (number, range<number>) ${_lt("The first value or range of the sample.")}
      value2 (number, range<number>, optional, repeating) ${_lt("Additional values or ranges to include in the sample.")}
    `),
        returns: ["NUMBER"],
        compute: function () {
            return Math.sqrt(VAR.compute(...arguments));
        },
    };
    // -----------------------------------------------------------------------------
    // STDEV.P
    // -----------------------------------------------------------------------------
    const STDEV_P = {
        description: _lt("Standard deviation of entire population."),
        args: args(`
      value1 (number, range<number>) ${_lt("The first value or range of the population.")}
      value2 (number, range<number>, optional, repeating) ${_lt("Additional values or ranges to include in the population.")}
    `),
        returns: ["NUMBER"],
        compute: function () {
            return Math.sqrt(VAR_P.compute(...arguments));
        },
    };
    // -----------------------------------------------------------------------------
    // STDEV.S
    // -----------------------------------------------------------------------------
    const STDEV_S = {
        description: _lt("Standard deviation."),
        args: args(`
      value1 (number, range<number>) ${_lt("The first value or range of the sample.")}
      value2 (number, range<number>, optional, repeating) ${_lt("Additional values or ranges to include in the sample.")}
    `),
        returns: ["NUMBER"],
        compute: function () {
            return Math.sqrt(VAR_S.compute(...arguments));
        },
    };
    // -----------------------------------------------------------------------------
    // STDEVA
    // -----------------------------------------------------------------------------
    const STDEVA = {
        description: _lt("Standard deviation of sample (text as 0)."),
        args: args(`
    value1 (number, range<number>) ${_lt("The first value or range of the sample.")}
    value2 (number, range<number>, optional, repeating) ${_lt("Additional values or ranges to include in the sample.")}
  `),
        returns: ["NUMBER"],
        compute: function () {
            return Math.sqrt(VARA.compute(...arguments));
        },
    };
    // -----------------------------------------------------------------------------
    // STDEVP
    // -----------------------------------------------------------------------------
    const STDEVP = {
        description: _lt("Standard deviation of entire population."),
        args: args(`
    value1 (number, range<number>) ${_lt("The first value or range of the population.")}
    value2 (number, range<number>, optional, repeating) ${_lt("Additional values or ranges to include in the population.")}
  `),
        returns: ["NUMBER"],
        compute: function () {
            return Math.sqrt(VARP.compute(...arguments));
        },
    };
    // -----------------------------------------------------------------------------
    // STDEVPA
    // -----------------------------------------------------------------------------
    const STDEVPA = {
        description: _lt("Standard deviation of entire population (text as 0)."),
        args: args(`
    value1 (number, range<number>) ${_lt("The first value or range of the population.")}
    value2 (number, range<number>, optional, repeating) ${_lt("Additional values or ranges to include in the population.")}
  `),
        returns: ["NUMBER"],
        compute: function () {
            return Math.sqrt(VARPA.compute(...arguments));
        },
    };
    // -----------------------------------------------------------------------------
    // VAR
    // -----------------------------------------------------------------------------
    const VAR = {
        description: _lt("Variance."),
        args: args(`
      value1 (number, range<number>) ${_lt("The first value or range of the sample.")}
      value2 (number, range<number>, optional, repeating) ${_lt("Additional values or ranges to include in the sample.")}
    `),
        returns: ["NUMBER"],
        compute: function () {
            return variance(arguments, true, false);
        },
    };
    // -----------------------------------------------------------------------------
    // VAR.P
    // -----------------------------------------------------------------------------
    const VAR_P = {
        description: _lt("Variance of entire population."),
        args: args(`
      value1 (number, range<number>) ${_lt("The first value or range of the population.")}
      value2 (number, range<number>, optional, repeating) ${_lt("Additional values or ranges to include in the population.")}
    `),
        returns: ["NUMBER"],
        compute: function () {
            return variance(arguments, false, false);
        },
    };
    // -----------------------------------------------------------------------------
    // VAR.S
    // -----------------------------------------------------------------------------
    const VAR_S = {
        description: _lt("Variance."),
        args: args(`
      value1 (number, range<number>) ${_lt("The first value or range of the sample.")}
      value2 (number, range<number>, optional, repeating) ${_lt("Additional values or ranges to include in the sample.")}
    `),
        returns: ["NUMBER"],
        compute: function () {
            return variance(arguments, true, false);
        },
    };
    // -----------------------------------------------------------------------------
    // VARA
    // -----------------------------------------------------------------------------
    const VARA = {
        description: _lt("Variance of sample (text as 0)."),
        args: args(`
    value1 (number, range<number>) ${_lt("The first value or range of the sample.")}
    value2 (number, range<number>, optional, repeating) ${_lt("Additional values or ranges to include in the sample.")}
  `),
        returns: ["NUMBER"],
        compute: function () {
            return variance(arguments, true, true);
        },
    };
    // -----------------------------------------------------------------------------
    // VARP
    // -----------------------------------------------------------------------------
    const VARP = {
        description: _lt("Variance of entire population."),
        args: args(`
    value1 (number, range<number>) ${_lt("The first value or range of the population.")}
    value2 (number, range<number>, optional, repeating) ${_lt("Additional values or ranges to include in the population.")}
  `),
        returns: ["NUMBER"],
        compute: function () {
            return variance(arguments, false, false);
        },
    };
    // -----------------------------------------------------------------------------
    // VARPA
    // -----------------------------------------------------------------------------
    const VARPA = {
        description: _lt("Variance of entire population (text as 0)."),
        args: args(`
    value1 (number, range<number>) ${_lt("The first value or range of the population.")}
    value2 (number, range<number>, optional, repeating) ${_lt("Additional values or ranges to include in the population.")}
  `),
        returns: ["NUMBER"],
        compute: function () {
            return variance(arguments, false, true);
        },
    };

    var statistical = /*#__PURE__*/Object.freeze({
        __proto__: null,
        AVEDEV: AVEDEV,
        AVERAGE: AVERAGE,
        AVERAGE_WEIGHTED: AVERAGE_WEIGHTED,
        AVERAGEA: AVERAGEA,
        AVERAGEIF: AVERAGEIF,
        AVERAGEIFS: AVERAGEIFS,
        COUNT: COUNT,
        COUNTA: COUNTA,
        COVAR: COVAR,
        COVARIANCE_P: COVARIANCE_P,
        COVARIANCE_S: COVARIANCE_S,
        LARGE: LARGE,
        MAX: MAX,
        MAXA: MAXA,
        MAXIFS: MAXIFS,
        MIN: MIN,
        MINA: MINA,
        MINIFS: MINIFS,
        SMALL: SMALL,
        STDEV: STDEV,
        STDEV_P: STDEV_P,
        STDEV_S: STDEV_S,
        STDEVA: STDEVA,
        STDEVP: STDEVP,
        STDEVPA: STDEVPA,
        VAR: VAR,
        VAR_P: VAR_P,
        VAR_S: VAR_S,
        VARA: VARA,
        VARP: VARP,
        VARPA: VARPA
    });

    function getMatchingCells(database, field, criteria) {
        // Exemple :
        //
        // # DATABASE             # CRITERIA          # field = "C"
        //
        // | A | B | C |          | A | C |
        // |===========|          |=======|
        // | 1 | x | j |          |<2 | j |
        // | 1 | Z | k |          |   | 7 |
        // | 5 | y | 7 |
        // 1 - Select coordinates of database columns
        const indexColNameDB = new Map();
        const dimRowDB = database.length;
        for (let indexCol = dimRowDB - 1; indexCol >= 0; indexCol--) {
            indexColNameDB.set(toString(database[indexCol][0]).toUpperCase(), indexCol);
        } // Ex: indexColNameDB = {A => 0, B => 1, C => 2}
        // 2 - Check if the field parameter exists in the column names of the database
        const typeofField = typeof field;
        let index;
        if (typeofField === "number") {
            // field may either be a text label corresponding to a column header in the
            // first row of database or a numeric index indicating which column to consider,
            // where the first column has the value 1.
            index = Math.trunc(field) - 1;
            if (index < 0 || index > dimRowDB - 1) {
                throw new Error(_lt("Function [[FUNCTION_NAME]] parameter 2 value is %s. Valid values are between 1 and %s inclusive.", field, dimRowDB));
            }
        }
        else {
            const colName = typeofField === "string" ? field.toUpperCase() : field;
            index = indexColNameDB.get(colName);
            if (index === undefined) {
                throw new Error(_lt("Function [[FUNCTION_NAME]] parameter 2 value is %s. It should be one of: %s.", field, [...indexColNameDB.keys()].map((v) => "'" + v + "'").join(", ")));
            }
        } // Ex: index = 2
        // 3 - For each criteria row, find database row that correspond
        const dimColCriteria = criteria[0].length;
        if (dimColCriteria < 2) {
            throw new Error(_lt(`[[FUNCTION_NAME]] criteria range must be at least 2 rows.`));
        }
        let matchingRows = new Set();
        const dimColDB = database[0].length;
        for (let indexRow = 1; indexRow < dimColCriteria; indexRow++) {
            let args = [];
            let existColNameDB = true;
            for (let indexCol = 0; indexCol < criteria.length; indexCol++) {
                const curentName = toString(criteria[indexCol][0]).toUpperCase();
                const indexColDB = indexColNameDB.get(curentName);
                const criter = criteria[indexCol][indexRow];
                if (criter !== undefined) {
                    if (indexColDB !== undefined) {
                        args.push([database[indexColDB].slice(1, dimColDB)]);
                        args.push(criter);
                    }
                    else {
                        existColNameDB = false;
                        break;
                    }
                }
            }
            // Ex: args1 = [[1,1,5], "<2", ["j","k",7], "j"]
            // Ex: args2 = [["j","k",7], "7"]
            if (existColNameDB) {
                if (args.length > 0) {
                    visitMatchingRanges(args, (i, j) => {
                        matchingRows.add(j);
                    }, true);
                }
                else {
                    // return indices of each database row when a criteria table row is void
                    matchingRows = new Set(Array(dimColDB - 1).keys());
                    break;
                }
            }
        } // Ex: matchingRows = {0, 2}
        // 4 - return for each database row corresponding, the cells corresponding to
        // the field parameter
        const fieldCol = database[index];
        // Ex: fieldCol = ["C", "j", "k", 7]
        const matchingCells = [...matchingRows].map((x) => fieldCol[x + 1]);
        // Ex: matchingCells = ["j", 7]
        return matchingCells;
    }
    const databaseArgs = args(`
  database (range) ${_lt("The array or range containing the data to consider, structured in such a way that the first row contains the labels for each column's values.")}
  field (any) ${_lt("Indicates which column in database contains the values to be extracted and operated on.")}
  criteria (range) ${_lt("An array or range containing zero or more criteria to filter the database values by before operating.")}
`);
    // -----------------------------------------------------------------------------
    // DAVERAGE
    // -----------------------------------------------------------------------------
    const DAVERAGE = {
        description: _lt("Average of a set of values from a table-like range."),
        args: databaseArgs,
        returns: ["NUMBER"],
        compute: function (database, field, criteria) {
            const cells = getMatchingCells(database, field, criteria);
            return AVERAGE.compute([cells]);
        },
    };
    // -----------------------------------------------------------------------------
    // DCOUNT
    // -----------------------------------------------------------------------------
    const DCOUNT = {
        description: _lt("Counts values from a table-like range."),
        args: databaseArgs,
        returns: ["NUMBER"],
        compute: function (database, field, criteria) {
            const cells = getMatchingCells(database, field, criteria);
            return COUNT.compute([cells]);
        },
    };
    // -----------------------------------------------------------------------------
    // DCOUNTA
    // -----------------------------------------------------------------------------
    const DCOUNTA = {
        description: _lt("Counts values and text from a table-like range."),
        args: databaseArgs,
        returns: ["NUMBER"],
        compute: function (database, field, criteria) {
            const cells = getMatchingCells(database, field, criteria);
            return COUNTA.compute([cells]);
        },
    };
    // -----------------------------------------------------------------------------
    // DGET
    // -----------------------------------------------------------------------------
    const DGET = {
        description: _lt("Single value from a table-like range."),
        args: databaseArgs,
        returns: ["NUMBER"],
        compute: function (database, field, criteria) {
            const cells = getMatchingCells(database, field, criteria);
            if (cells.length > 1) {
                throw new Error(_lt(`More than one match found in DGET evaluation.`));
            }
            return cells[0];
        },
    };
    // -----------------------------------------------------------------------------
    // DMAX
    // -----------------------------------------------------------------------------
    const DMAX = {
        description: _lt("Maximum of values from a table-like range."),
        args: databaseArgs,
        returns: ["NUMBER"],
        compute: function (database, field, criteria) {
            const cells = getMatchingCells(database, field, criteria);
            return MAX.compute([cells]);
        },
    };
    // -----------------------------------------------------------------------------
    // DMIN
    // -----------------------------------------------------------------------------
    const DMIN = {
        description: _lt("Minimum of values from a table-like range."),
        args: databaseArgs,
        returns: ["NUMBER"],
        compute: function (database, field, criteria) {
            const cells = getMatchingCells(database, field, criteria);
            return MIN.compute([cells]);
        },
    };
    // -----------------------------------------------------------------------------
    // DPRODUCT
    // -----------------------------------------------------------------------------
    const DPRODUCT = {
        description: _lt("Product of values from a table-like range."),
        args: databaseArgs,
        returns: ["NUMBER"],
        compute: function (database, field, criteria) {
            const cells = getMatchingCells(database, field, criteria);
            return PRODUCT.compute([cells]);
        },
    };
    // -----------------------------------------------------------------------------
    // DSTDEV
    // -----------------------------------------------------------------------------
    const DSTDEV = {
        description: _lt("Standard deviation of population sample from table."),
        args: databaseArgs,
        returns: ["NUMBER"],
        compute: function (database, field, criteria) {
            const cells = getMatchingCells(database, field, criteria);
            return STDEV.compute([cells]);
        },
    };
    // -----------------------------------------------------------------------------
    // DSTDEVP
    // -----------------------------------------------------------------------------
    const DSTDEVP = {
        description: _lt("Standard deviation of entire population from table."),
        args: databaseArgs,
        returns: ["NUMBER"],
        compute: function (database, field, criteria) {
            const cells = getMatchingCells(database, field, criteria);
            return STDEVP.compute([cells]);
        },
    };
    // -----------------------------------------------------------------------------
    // DSUM
    // -----------------------------------------------------------------------------
    const DSUM = {
        description: _lt("Sum of values from a table-like range."),
        args: databaseArgs,
        returns: ["NUMBER"],
        compute: function (database, field, criteria) {
            const cells = getMatchingCells(database, field, criteria);
            return SUM.compute([cells]);
        },
    };
    // -----------------------------------------------------------------------------
    // DVAR
    // -----------------------------------------------------------------------------
    const DVAR = {
        description: _lt("Variance of population sample from table-like range."),
        args: databaseArgs,
        returns: ["NUMBER"],
        compute: function (database, field, criteria) {
            const cells = getMatchingCells(database, field, criteria);
            return VAR.compute([cells]);
        },
    };
    // -----------------------------------------------------------------------------
    // DVARP
    // -----------------------------------------------------------------------------
    const DVARP = {
        description: _lt("Variance of a population from a table-like range."),
        args: databaseArgs,
        returns: ["NUMBER"],
        compute: function (database, field, criteria) {
            const cells = getMatchingCells(database, field, criteria);
            return VARP.compute([cells]);
        },
    };

    var database = /*#__PURE__*/Object.freeze({
        __proto__: null,
        DAVERAGE: DAVERAGE,
        DCOUNT: DCOUNT,
        DCOUNTA: DCOUNTA,
        DGET: DGET,
        DMAX: DMAX,
        DMIN: DMIN,
        DPRODUCT: DPRODUCT,
        DSTDEV: DSTDEV,
        DSTDEVP: DSTDEVP,
        DSUM: DSUM,
        DVAR: DVAR,
        DVARP: DVARP
    });

    const INITIAL_1900_DAY = new Date(1899, 11, 30);
    // -----------------------------------------------------------------------------
    // DATE
    // -----------------------------------------------------------------------------
    const DATE = {
        description: _lt("Converts year/month/day into a date."),
        args: args(`
    year (number) ${_lt("The year component of the date.")}")}
    month (number) ${_lt("The month component of the date.")}")}
    day (number) ${_lt("The day component of the date.")}")}
    `),
        returns: ["DATE"],
        compute: function (year, month, day) {
            let _year = Math.trunc(toNumber(year));
            const _month = Math.trunc(toNumber(month));
            const _day = Math.trunc(toNumber(day));
            // For years less than 0 or greater than 10000, return #ERROR.
            if (_year < 0 || 10000 <= _year) {
                throw new Error(_lt(`function DATE parameter year should be greater or equal to 0 and lesser than 10000.`));
            }
            // Between 0 and 1899, we add that value to 1900 to calculate the year
            if (_year < 1900) {
                _year += 1900;
            }
            const jsDate = new Date(_year, _month - 1, _day);
            const delta = jsDate.getTime() - INITIAL_1900_DAY.getTime();
            if (delta < 0) {
                throw new Error(_lt(`function DATE result should not be lesser than 01/01/1900`));
            }
            return {
                value: Math.round(delta / 86400000),
                format: "m/d/yyyy",
                jsDate: jsDate,
            };
        },
    };
    // -----------------------------------------------------------------------------
    // DATEVALUE
    // -----------------------------------------------------------------------------
    const DATEVALUE = {
        description: _lt("Converts a date string to a date value."),
        args: args(`
      date_string (string) ${_lt("The string representing the date.")}
    `),
        returns: ["NUMBER"],
        compute: function (date_string) {
            const _dateString = toString(date_string);
            const datetime = parseDateTime(_dateString);
            if (datetime === null) {
                throw new Error(_lt("DATEVALUE parameter '%s' cannot be parsed to date/time.", _dateString));
            }
            return Math.trunc(datetime.value);
        },
    };
    // -----------------------------------------------------------------------------
    // DAY
    // -----------------------------------------------------------------------------
    const DAY = {
        description: _lt("Day of the month that a specific date falls on."),
        args: args(`
      date (string) ${_lt("The date from which to extract the day.")}
    `),
        returns: ["NUMBER"],
        compute: function (date) {
            return toNativeDate(date).getDate();
        },
    };
    // -----------------------------------------------------------------------------
    // DAYS
    // -----------------------------------------------------------------------------
    const DAYS = {
        description: _lt("Number of days between two dates."),
        args: args(`
      end_date (date) ${_lt("The end of the date range.")}
      start_date (date) ${_lt("The start of the date range.")}
    `),
        returns: ["NUMBER"],
        compute: function (end_date, start_date) {
            const _endDate = toNativeDate(end_date);
            const _startDate = toNativeDate(start_date);
            const dateDif = _endDate.getTime() - _startDate.getTime();
            return Math.round(dateDif / 86400000);
        },
    };
    // -----------------------------------------------------------------------------
    // EDATE
    // -----------------------------------------------------------------------------
    const EDATE = {
        description: _lt("Date a number of months before/after another date."),
        args: args(`
    start_date (date) ${_lt("The date from which to calculate the result.")}
    months (number) ${_lt("The number of months before (negative) or after (positive) 'start_date' to calculate.")}
    `),
        returns: ["DATE"],
        compute: function (start_date, months) {
            const _startDate = toNativeDate(start_date);
            const _months = Math.trunc(toNumber(months));
            const yStart = _startDate.getFullYear();
            const mStart = _startDate.getMonth();
            const dStart = _startDate.getDate();
            const jsDate = new Date(yStart, mStart + _months, dStart);
            const delta = jsDate.getTime() - INITIAL_1900_DAY.getTime();
            return {
                value: Math.round(delta / 86400000),
                format: "m/d/yyyy",
                jsDate: jsDate,
            };
        },
    };
    // -----------------------------------------------------------------------------
    // EOMONTH
    // -----------------------------------------------------------------------------
    const EOMONTH = {
        description: _lt("Last day of a month before or after a date."),
        args: args(`
    start_date (date) ${_lt("The date from which to calculate the result.")}
    months (number) ${_lt("The number of months before (negative) or after (positive) 'start_date' to consider.")}
    `),
        returns: ["DATE"],
        compute: function (start_date, months) {
            const _startDate = toNativeDate(start_date);
            const _months = Math.trunc(toNumber(months));
            const yStart = _startDate.getFullYear();
            const mStart = _startDate.getMonth();
            const jsDate = new Date(yStart, mStart + _months + 1, 0);
            const delta = jsDate.getTime() - INITIAL_1900_DAY.getTime();
            return {
                value: Math.round(delta / 86400000),
                format: "m/d/yyyy",
                jsDate: jsDate,
            };
        },
    };
    // -----------------------------------------------------------------------------
    // HOUR
    // -----------------------------------------------------------------------------
    const HOUR = {
        description: _lt("Hour component of a specific time."),
        args: args(`
    time (date) ${_lt("The time from which to calculate the hour component.")}
    `),
        returns: ["NUMBER"],
        compute: function (date) {
            return toNativeDate(date).getHours();
        },
    };
    // -----------------------------------------------------------------------------
    // ISOWEEKNUM
    // -----------------------------------------------------------------------------
    const ISOWEEKNUM = {
        description: _lt("ISO week number of the year."),
        args: args(`
    date (date) ${_lt("The date for which to determine the ISO week number. Must be a reference to a cell containing a date, a function returning a date type, or a number.")}
    `),
        returns: ["NUMBER"],
        compute: function (date) {
            const _date = toNativeDate(date);
            const y = _date.getFullYear();
            // 1 - As the 1st week of a year can start the previous year or after the 1st
            // january we first look if the date is in the weeks of the current year, previous
            // year or year after.
            // A - We look for the current year, the first days of the first week
            // and the last days of the last week
            // The first week of the year is the week that contains the first
            // Thursday of the year.
            let firstThursday = 1;
            while (new Date(y, 0, firstThursday).getDay() !== 4) {
                firstThursday += 1;
            }
            const firstDayOfFirstWeek = new Date(y, 0, firstThursday - 3);
            // The last week of the year is the week that contains the last Thursday of
            // the year.
            let lastThursday = 31;
            while (new Date(y, 11, lastThursday).getDay() !== 4) {
                lastThursday -= 1;
            }
            const lastDayOfLastWeek = new Date(y, 11, lastThursday + 3);
            // B - If our date > lastDayOfLastWeek then it's in the weeks of the year after
            // If our date < firstDayOfFirstWeek then it's in the weeks of the year before
            let offsetYear;
            if (firstDayOfFirstWeek.getTime() <= _date.getTime()) {
                if (_date.getTime() <= lastDayOfLastWeek.getTime()) {
                    offsetYear = 0;
                }
                else {
                    offsetYear = 1;
                }
            }
            else {
                offsetYear = -1;
            }
            // 2 - now that the year is known, we are looking at the difference between
            // the first day of this year and the date. The difference in days divided by
            // 7 gives us the week number
            let firstDay;
            switch (offsetYear) {
                case 0:
                    firstDay = firstDayOfFirstWeek;
                    break;
                case 1:
                    // firstDay is the 1st day of the 1st week of the year after
                    // firstDay = lastDayOfLastWeek + 1 Day
                    firstDay = new Date(y, 11, lastThursday + 3 + 1);
                    break;
                case -1:
                    // firstDay is the 1st day of the 1st week of the previous year.
                    // The first week of the previous year is the week that contains the
                    // first Thursday of the previous year.
                    let firstThursdayPreviousYear = 1;
                    while (new Date(y - 1, 0, firstThursdayPreviousYear).getDay() !== 4) {
                        firstThursdayPreviousYear += 1;
                    }
                    firstDay = new Date(y - 1, 0, firstThursdayPreviousYear - 3);
                    break;
            }
            const dif = (_date.getTime() - firstDay.getTime()) / 86400000;
            return Math.floor(dif / 7) + 1;
        },
    };
    // -----------------------------------------------------------------------------
    // MINUTE
    // -----------------------------------------------------------------------------
    const MINUTE = {
        description: _lt("Minute component of a specific time."),
        args: args(`
      time (date) ${_lt("The time from which to calculate the minute component.")}
    `),
        returns: ["NUMBER"],
        compute: function (date) {
            return toNativeDate(date).getMinutes();
        },
    };
    // -----------------------------------------------------------------------------
    // MONTH
    // -----------------------------------------------------------------------------
    const MONTH = {
        description: _lt("Month of the year a specific date falls in"),
        args: args(`
      date (date) ${_lt("The date from which to extract the month.")}
    `),
        returns: ["NUMBER"],
        compute: function (date) {
            return toNativeDate(date).getMonth() + 1;
        },
    };
    // -----------------------------------------------------------------------------
    // NETWORKDAYS
    // -----------------------------------------------------------------------------
    const NETWORKDAYS = {
        description: _lt("Net working days between two provided days."),
        args: args(`
      start_date (date) ${_lt("The start date of the period from which to calculate the number of net working days.")}
      end_date (date) ${_lt("The end date of the period from which to calculate the number of net working days.")}
      holidays (date, range<date>, optional) ${_lt("A range or array constant containing the date serial numbers to consider holidays.")}
    `),
        returns: ["NUMBER"],
        compute: function (start_date, end_date, holidays) {
            return NETWORKDAYS_INTL.compute(start_date, end_date, 1, holidays);
        },
    };
    // -----------------------------------------------------------------------------
    // NETWORKDAYS.INTL
    // -----------------------------------------------------------------------------
    /**
     * Transform weekend Spreadsheet informations into Date Day JavaScript informations.
     * Take string (String method) or number (Number method), return array of numbers.
     *
     * String method: weekends can be specified using seven 0’s and 1’s, where the
     * first number in the set represents Monday and the last number is for Sunday.
     * A zero means that the day is a work day, a 1 means that the day is a weekend.
     * For example, “0000011” would mean Saturday and Sunday are weekends.
     *
     * Number method: instead of using the string method above, a single number can
     * be used. 1 = Saturday/Sunday are weekends, 2 = Sunday/Monday, and this pattern
     * repeats until 7 = Friday/Saturday. 11 = Sunday is the only weekend, 12 = Monday
     * is the only weekend, and this pattern repeats until 17 = Saturday is the only
     * weekend.
     *
     * Exemple:
     * - 11 return [0] (correspond to Sunday)
     * - 12 return [1] (correspond to Monday)
     * - 3 return [1,2] (correspond to Monday and Tuesday)
     * - "0101010" return [2,4,6] (correspond to Tuesday, Thursday and Saturday)
     */
    function weekendToDayNumber(weekend) {
        if (typeof weekend === "string") {
            let result = [];
            if (weekend.length === 7) {
                for (let i = 0; i < 7; i++) {
                    switch (weekend.charAt(i)) {
                        case "0":
                            break;
                        case "1":
                            // "1000000" corespond to Monday [1]
                            // "0000010" corespond to Saturday [6]
                            // "0000001" corespond to Sunday [0]
                            result.push(i + 1 === 7 ? 0 : i + 1);
                            break;
                        default:
                            throw new Error(_lt("Function [[FUNCTION_NAME]] parameter 3 requires a string composed of 0 or 1. Actual string is '%s'.", weekend));
                    }
                }
                return result;
            }
            throw new Error(_lt("Function [[FUNCTION_NAME]] parameter 3 requires a string with 7 characters. Actual string is '%s'.", weekend));
        }
        if (typeof weekend === "number") {
            if (1 <= weekend && weekend <= 7) {
                // 1 = Saturday/Sunday are weekends
                // 2 = Sunday/Monday
                // ...
                // 7 = Friday/Saturday.
                return [weekend - 2 === -1 ? 6 : weekend - 2, weekend - 1];
            }
            if (11 <= weekend && weekend <= 17) {
                // 11 = Sunday is the only weekend
                // 12 = Monday is the only weekend
                // ...
                // 17 = Saturday is the only weekend.
                return [weekend - 11];
            }
            throw new Error(_lt("Function [[FUNCTION_NAME]] parameter 3 requires a string or a number in the range 1-7 or 11-17. Actual number is %s.", weekend.toString()));
        }
        throw new Error(_lt(`Function [[FUNCTION_NAME]] parameter 3 requires a number or a string.`));
    }
    const NETWORKDAYS_INTL = {
        description: _lt("Net working days between two dates (specifying weekends)."),
        args: args(`
      start_date (date) ${_lt("The start date of the period from which to calculate the number of net working days.")}
      end_date (date) ${_lt("The end date of the period from which to calculate the number of net working days.")}
      weekend (any, optional, default=1) ${_lt("A number or string representing which days of the week are considered weekends.")}
      holidays (date, range<date>, optional) ${_lt("A range or array constant containing the dates to consider as holidays.")}
    `),
        returns: ["NUMBER"],
        compute: function (start_date, end_date, weekend = 1, holidays = undefined) {
            const _startDate = toNativeDate(start_date);
            const _endDate = toNativeDate(end_date);
            const daysWeekend = weekendToDayNumber(weekend);
            let timesHoliday = new Set();
            if (holidays !== undefined) {
                visitAny(holidays, (h) => {
                    const holiday = toNativeDate(h);
                    timesHoliday.add(holiday.getTime());
                });
            }
            const invertDate = _startDate.getTime() > _endDate.getTime();
            const stopDate = new Date((invertDate ? _startDate : _endDate).getTime());
            let stepDate = new Date((invertDate ? _endDate : _startDate).getTime());
            const timeStopDate = stopDate.getTime();
            let timeStepDate = stepDate.getTime();
            let netWorkingDay = 0;
            while (timeStepDate <= timeStopDate) {
                if (!daysWeekend.includes(stepDate.getDay()) && !timesHoliday.has(timeStepDate)) {
                    netWorkingDay += 1;
                }
                stepDate.setDate(stepDate.getDate() + 1);
                timeStepDate = stepDate.getTime();
            }
            return invertDate ? -netWorkingDay : netWorkingDay;
        },
    };
    // -----------------------------------------------------------------------------
    // NOW
    // -----------------------------------------------------------------------------
    const NOW = {
        description: _lt("Current date and time as a date value."),
        args: [],
        returns: ["DATE"],
        compute: function () {
            let today = new Date();
            today.setMilliseconds(0);
            const delta = today.getTime() - INITIAL_1900_DAY.getTime();
            const time = today.getHours() / 24 + today.getMinutes() / 1440 + today.getSeconds() / 86400;
            return {
                value: Math.floor(delta / 86400000) + time,
                format: "m/d/yyyy hh:mm:ss",
                jsDate: today,
            };
        },
    };
    // -----------------------------------------------------------------------------
    // SECOND
    // -----------------------------------------------------------------------------
    const SECOND = {
        description: _lt("Minute component of a specific time."),
        args: args(`
      time (date) ${_lt("The time from which to calculate the second component.")}
    `),
        returns: ["NUMBER"],
        compute: function (date) {
            return toNativeDate(date).getSeconds();
        },
    };
    // -----------------------------------------------------------------------------
    // TIME
    // -----------------------------------------------------------------------------
    const TIME = {
        description: _lt("Converts hour/minute/second into a time."),
        args: args(`
    hour (number) ${_lt("The hour component of the time.")}
    minute (number) ${_lt("The minute component of the time.")}
    second (number) ${_lt("The second component of the time.")}
    `),
        returns: ["DATE"],
        compute: function (hour, minute, second) {
            let _hour = Math.trunc(toNumber(hour));
            let _minute = Math.trunc(toNumber(minute));
            let _second = Math.trunc(toNumber(second));
            _minute += Math.floor(_second / 60);
            _second = (_second % 60) + (_second < 0 ? 60 : 0);
            _hour += Math.floor(_minute / 60);
            _minute = (_minute % 60) + (_minute < 0 ? 60 : 0);
            _hour %= 24;
            if (_hour < 0) {
                throw new Error(_lt(`function Time result should not be negative`));
            }
            const jsDate = new Date(1899, 11, 30, _hour, _minute, _second);
            return {
                value: _hour / 24 + _minute / (24 * 60) + _second / (24 * 60 * 60),
                format: "hh:mm:ss a",
                jsDate: jsDate,
            };
        },
    };
    // -----------------------------------------------------------------------------
    // TIMEVALUE
    // -----------------------------------------------------------------------------
    const TIMEVALUE = {
        description: _lt("Converts a time string into its serial number representation."),
        args: args(`
      time_string (string) ${_lt("The string that holds the time representation.")}
    `),
        returns: ["NUMBER"],
        compute: function (time_string) {
            const _timeString = toString(time_string);
            const datetime = parseDateTime(_timeString);
            if (datetime === null) {
                throw new Error(_lt("TIMEVALUE parameter '%s' cannot be parsed to date/time.", _timeString));
            }
            const result = datetime.value - Math.trunc(datetime.value);
            return result < 0 ? 1 + result : result;
        },
    };
    // -----------------------------------------------------------------------------
    // TODAY
    // -----------------------------------------------------------------------------
    const TODAY = {
        description: _lt("Current date as a date value."),
        args: [],
        returns: ["DATE"],
        compute: function () {
            const today = new Date();
            const jsDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const delta = jsDate.getTime() - INITIAL_1900_DAY.getTime();
            return {
                value: Math.round(delta / 86400000),
                format: "m/d/yyyy",
                jsDate: jsDate,
            };
        },
    };
    // -----------------------------------------------------------------------------
    // WEEKDAY
    // -----------------------------------------------------------------------------
    const WEEKDAY = {
        description: _lt("Day of the week of the date provided (as number)."),
        args: args(`
    date (date) ${_lt("The date for which to determine the day of the week. Must be a reference to a cell containing a date, a function returning a date type, or a number.")}
    type (number, optional, default=1) ${_lt("A number indicating which numbering system to use to represent weekdays. By default, counts starting with Sunday = 1.")}
  `),
        returns: ["NUMBER"],
        compute: function (date, type = 1) {
            const _date = toNativeDate(date);
            const _type = Math.round(toNumber(type));
            const m = _date.getDay();
            switch (_type) {
                case 1:
                    return m + 1;
                case 2:
                    return m === 0 ? 7 : m;
                case 3:
                    return m === 0 ? 6 : m - 1;
            }
            throw new Error(_lt("Function WEEKDAY parameter 2 value %s is out of range.", _type.toString()));
        },
    };
    // -----------------------------------------------------------------------------
    // WEEKNUM
    // -----------------------------------------------------------------------------
    const WEEKNUM = {
        description: _lt("Week number of the year."),
        args: args(`
    date (date) ${_lt("The date for which to determine the week number. Must be a reference to a cell containing a date, a function returning a date type, or a number.")}
    type (number, optional, default=1) ${_lt("A number representing the day that a week starts on. Sunday = 1.")}
    `),
        returns: ["NUMBER"],
        compute: function (date, type = 1) {
            const _date = toNativeDate(date);
            const _type = Math.round(toNumber(type));
            let startDayOfWeek;
            if (_type === 1 || _type === 2) {
                startDayOfWeek = _type - 1;
            }
            else if (11 <= _type && _type <= 17) {
                startDayOfWeek = _type - 10 === 7 ? 0 : _type - 10;
            }
            else if (_type === 21) {
                return ISOWEEKNUM.compute(date);
            }
            else {
                throw new Error(_lt("Function WEEKNUM parameter 2 value %s is out of range.", _type.toString()));
            }
            const y = _date.getFullYear();
            let dayStart = 1;
            let startDayOfFirstWeek = new Date(y, 0, dayStart);
            while (startDayOfFirstWeek.getDay() !== startDayOfWeek) {
                dayStart += 1;
                startDayOfFirstWeek = new Date(y, 0, dayStart);
            }
            const dif = (_date.getTime() - startDayOfFirstWeek.getTime()) / 86400000;
            if (dif < 0) {
                return 1;
            }
            return Math.floor(dif / 7) + (dayStart === 1 ? 1 : 2);
        },
    };
    // -----------------------------------------------------------------------------
    // WORKDAY
    // -----------------------------------------------------------------------------
    const WORKDAY = {
        description: _lt("Number of working days from start date."),
        args: args(`
      start_date (date) ${_lt("The date from which to begin counting.")}
      num_days (number) ${_lt("The number of working days to advance from start_date. If negative, counts backwards.")}
      holidays (date, range<date>, optional) ${_lt("A range or array constant containing the dates to consider holidays.")}
      `),
        returns: ["NUMBER"],
        compute: function (start_date, num_days, holidays = undefined) {
            return WORKDAY_INTL.compute(start_date, num_days, 1, holidays);
        },
    };
    // -----------------------------------------------------------------------------
    // WORKDAY.INTL
    // -----------------------------------------------------------------------------
    const WORKDAY_INTL = {
        description: _lt("Net working days between two dates (specifying weekends)."),
        args: args(`
      start_date (date) ${_lt("The date from which to begin counting.")}
      num_days (number) ${_lt("The number of working days to advance from start_date. If negative, counts backwards.")}
      weekend (any, optional, default=1) ${_lt("A number or string representing which days of the week are considered weekends.")}
      holidays (date, range<date>, optional) ${_lt("A range or array constant containing the dates to consider holidays.")}
    `),
        returns: ["DATE"],
        compute: function (start_date, num_days, weekend = 1, holidays = undefined) {
            let _startDate = toNativeDate(start_date);
            let _numDays = Math.trunc(toNumber(num_days));
            if (weekend === "1111111") {
                throw new Error(_lt(`Function WORKDAY.INTL parameter 3 cannot be equal to '1111111'.`));
            }
            const daysWeekend = weekendToDayNumber(weekend);
            let timesHoliday = new Set();
            if (holidays !== undefined) {
                visitAny(holidays, (h) => {
                    const holiday = toNativeDate(h);
                    timesHoliday.add(holiday.getTime());
                });
            }
            let stepDate = new Date(_startDate.getTime());
            let timeStepDate = stepDate.getTime();
            const unitDay = Math.sign(_numDays);
            let stepDay = Math.abs(_numDays);
            while (stepDay > 0) {
                stepDate.setDate(stepDate.getDate() + unitDay);
                timeStepDate = stepDate.getTime();
                if (!daysWeekend.includes(stepDate.getDay()) && !timesHoliday.has(timeStepDate)) {
                    stepDay -= 1;
                }
            }
            const delta = timeStepDate - INITIAL_1900_DAY.getTime();
            return {
                value: Math.round(delta / 86400000),
                format: "m/d/yyyy",
                jsDate: stepDate,
            };
        },
    };
    // -----------------------------------------------------------------------------
    // YEAR
    // -----------------------------------------------------------------------------
    const YEAR = {
        description: _lt("Year specified by a given date."),
        args: args(`
    date (date) ${_lt("The date from which to extract the year.")}
    `),
        returns: ["NUMBER"],
        compute: function (date) {
            return toNativeDate(date).getFullYear();
        },
    };

    var date = /*#__PURE__*/Object.freeze({
        __proto__: null,
        DATE: DATE,
        DATEVALUE: DATEVALUE,
        DAY: DAY,
        DAYS: DAYS,
        EDATE: EDATE,
        EOMONTH: EOMONTH,
        HOUR: HOUR,
        ISOWEEKNUM: ISOWEEKNUM,
        MINUTE: MINUTE,
        MONTH: MONTH,
        NETWORKDAYS: NETWORKDAYS,
        NETWORKDAYS_INTL: NETWORKDAYS_INTL,
        NOW: NOW,
        SECOND: SECOND,
        TIME: TIME,
        TIMEVALUE: TIMEVALUE,
        TODAY: TODAY,
        WEEKDAY: WEEKDAY,
        WEEKNUM: WEEKNUM,
        WORKDAY: WORKDAY,
        WORKDAY_INTL: WORKDAY_INTL,
        YEAR: YEAR
    });

    // -----------------------------------------------------------------------------
    // ISERROR
    // -----------------------------------------------------------------------------
    const ISERROR = {
        description: _lt("Whether a value is an error."),
        args: args(`value (any, lazy) ${_lt("The value to be verified as an error type.")}`),
        returns: ["BOOLEAN"],
        compute: function (value) {
            try {
                value();
                return false;
            }
            catch (e) {
                return true;
            }
        },
    };
    // -----------------------------------------------------------------------------
    // ISLOGICAL
    // -----------------------------------------------------------------------------
    const ISLOGICAL = {
        description: _lt("Whether a value is `true` or `false`."),
        args: args(`value (any) ${_lt("The value to be verified as a logical TRUE or FALSE.")}`),
        returns: ["BOOLEAN"],
        compute: function (value) {
            return typeof value === "boolean";
        },
    };
    // -----------------------------------------------------------------------------
    // ISNONTEXT
    // -----------------------------------------------------------------------------
    const ISNONTEXT = {
        description: _lt("Whether a value is non-textual."),
        args: args(`value (any) ${_lt("The value to be checked.")}`),
        returns: ["BOOLEAN"],
        compute: function (value) {
            return typeof value !== "string";
        },
    };
    // -----------------------------------------------------------------------------
    // ISNUMBER
    // -----------------------------------------------------------------------------
    const ISNUMBER = {
        description: _lt("Whether a value is a number."),
        args: args(`value (any) ${_lt("The value to be verified as a number.")}`),
        returns: ["BOOLEAN"],
        compute: function (value) {
            return typeof value === "number";
        },
    };
    // -----------------------------------------------------------------------------
    // ISTEXT
    // -----------------------------------------------------------------------------
    const ISTEXT = {
        description: _lt("Whether a value is text."),
        args: args(`value (any) ${_lt("The value to be verified as text.")}`),
        returns: ["BOOLEAN"],
        compute: function (value) {
            return typeof value === "string";
        },
    };

    var info = /*#__PURE__*/Object.freeze({
        __proto__: null,
        ISERROR: ISERROR,
        ISLOGICAL: ISLOGICAL,
        ISNONTEXT: ISNONTEXT,
        ISNUMBER: ISNUMBER,
        ISTEXT: ISTEXT
    });

    // -----------------------------------------------------------------------------
    // WAIT
    // -----------------------------------------------------------------------------
    const WAIT = {
        description: _lt("Wait"),
        args: args(`ms (number) ${_lt("wait time in milliseconds")}`),
        returns: ["ANY"],
        async: true,
        compute: function (delay) {
            return new Promise(function (resolve, reject) {
                setTimeout(function () {
                    resolve(delay);
                }, delay);
            });
        },
    };
    // -----------------------------------------------------------------------------
    // AND
    // -----------------------------------------------------------------------------
    const AND = {
        description: _lt("Logical `and` operator."),
        args: args(`
      logical_expression1 (boolean, range<boolean>) ${_lt("An expression or reference to a cell containing an expression that represents some logical value, i.e. TRUE or FALSE, or an expression that can be coerced to a logical value.")}
      logical_expression2 (boolean, range<boolean>, optional, repeating) ${_lt("More expressions that represent logical values.")}
    `),
        returns: ["BOOLEAN"],
        compute: function () {
            let result = true;
            let foundBoolean = false;
            visitBooleans(arguments, (b) => {
                result = result && b;
                foundBoolean = true;
                return result;
            });
            if (!foundBoolean) {
                throw new Error(_lt(`AND has no valid input data.`));
            }
            return result;
        },
    };
    // -----------------------------------------------------------------------------
    // IF
    // -----------------------------------------------------------------------------
    const IF = {
        description: _lt("Returns value depending on logical expression."),
        args: args(`
      logical_expression (boolean) ${_lt("An expression or reference to a cell containing an expression that represents some logical value, i.e. TRUE or FALSE.")}
      value_if_true (any, lazy) ${_lt("The value the function returns if logical_expression is TRUE.")}
      value_if_false (any, lazy, optional, default=FALSE) ${_lt("The value the function returns if logical_expression is FALSE.")}
    `),
        returns: ["ANY"],
        compute: function (logical_expression, value_if_true, value_if_false = () => false) {
            const result = toBoolean(logical_expression) ? value_if_true() : value_if_false();
            return result === null ? "" : result;
        },
    };
    // -----------------------------------------------------------------------------
    // IFERROR
    // -----------------------------------------------------------------------------
    const IFERROR = {
        description: _lt("Value if it is not an error, otherwise 2nd argument."),
        args: args(`
    value (any, lazy) ${_lt("The value to return if value itself is not an error.")}
    value_if_error (any, lazy, optional, default="") ${_lt("The value the function returns if value is an error.")}
  `),
        returns: ["ANY"],
        compute: function (value, value_if_error = () => "") {
            let result;
            try {
                result = value();
            }
            catch (e) {
                result = value_if_error();
            }
            return result === null ? "" : result;
        },
    };
    // -----------------------------------------------------------------------------
    // IFS
    // -----------------------------------------------------------------------------
    const IFS = {
        description: _lt("Returns a value depending on multiple logical expressions."),
        args: args(`
      condition1 (boolean, lazy) ${_lt("The first condition to be evaluated. This can be a boolean, a number, an array, or a reference to any of those.")}
      value1 (any, lazy) ${_lt("The returned value if condition1 is TRUE.")}
      additional_values (any, lazy, optional, repeating) ${_lt("Additional conditions and values to be evaluated if the previous ones are FALSE.")}
    `),
        // @compatibility: on google sheets, args definitions are next:
        // condition1 (boolean) The first condition to be evaluated. This can be a boolean, a number, an array, or a reference to any of those.
        // value1 (any) The returned value if condition1 is TRUE.
        // condition2 (boolean, optional, repeating) Additional conditions to be evaluated if the previous ones are FALSE.
        // value2 (any, optional, repeating) Additional values to be returned if their corresponding conditions are TRUE.
        returns: ["ANY"],
        compute: function () {
            if (arguments.length % 2 === 1) {
                throw new Error(_lt(`Wrong number of arguments. Expected an even number of arguments.`));
            }
            for (let n = 0; n < arguments.length - 1; n += 2) {
                if (toBoolean(arguments[n]())) {
                    return arguments[n + 1]();
                }
            }
            throw new Error(_lt(`No match.`));
        },
    };
    // -----------------------------------------------------------------------------
    // NOT
    // -----------------------------------------------------------------------------
    const NOT = {
        description: _lt("Returns opposite of provided logical value."),
        args: args(`logical_expression (boolean) ${_lt("An expression or reference to a cell holding an expression that represents some logical value.")}
    `),
        returns: ["BOOLEAN"],
        compute: function (logical_expression) {
            return !toBoolean(logical_expression);
        },
    };
    // -----------------------------------------------------------------------------
    // OR
    // -----------------------------------------------------------------------------
    const OR = {
        description: _lt("Logical `or` operator."),
        args: args(`
      logical_expression1 (boolean, range<boolean>) ${_lt("An expression or reference to a cell containing an expression that represents some logical value, i.e. TRUE or FALSE, or an expression that can be coerced to a logical value.")}
      logical_expression2 (boolean, range<boolean>, optional, repeating) ${_lt("More expressions that evaluate to logical values.")}
    `),
        returns: ["BOOLEAN"],
        compute: function () {
            let result = false;
            let foundBoolean = false;
            visitBooleans(arguments, (b) => {
                result = result || b;
                foundBoolean = true;
                return !result;
            });
            if (!foundBoolean) {
                throw new Error(_lt(`OR has no valid input data.`));
            }
            return result;
        },
    };
    // -----------------------------------------------------------------------------
    // XOR
    // -----------------------------------------------------------------------------
    const XOR = {
        description: _lt("Logical `xor` operator."),
        args: args(`
      logical_expression1 (boolean, range<boolean>) ${_lt("An expression or reference to a cell containing an expression that represents some logical value, i.e. TRUE or FALSE, or an expression that can be coerced to a logical value.")}
      logical_expression2 (boolean, range<boolean>, optional, repeating) ${_lt("More expressions that evaluate to logical values.")}
    `),
        returns: ["BOOLEAN"],
        compute: function () {
            let result = false;
            let foundBoolean = false;
            visitBooleans(arguments, (b) => {
                result = result ? !b : b;
                foundBoolean = true;
                return true;
            });
            if (!foundBoolean) {
                throw new Error(_lt(`XOR has no valid input data.`));
            }
            return result;
        },
    };

    var logical = /*#__PURE__*/Object.freeze({
        __proto__: null,
        WAIT: WAIT,
        AND: AND,
        IF: IF,
        IFERROR: IFERROR,
        IFS: IFS,
        NOT: NOT,
        OR: OR,
        XOR: XOR
    });

    /**
     * Perform a linear search and return the index of the perfect match.
     * -1 is returned if no value is found.
     *
     * Example:
     * - [3, 6, 10], 3 => 0
     * - [3, 6, 10], 6 => 1
     * - [3, 6, 10], 9 => -1
     * - [3, 6, 10], 2 => -1
     */
    function linearSearch(range, target) {
        for (let i = 0; i < range.length; i++) {
            if (range[i] === target) {
                return i;
            }
        }
        // no value is found, -1 is returned
        return -1;
    }
    // -----------------------------------------------------------------------------
    // LOOKUP
    // -----------------------------------------------------------------------------
    const LOOKUP = {
        description: _lt(`Look up a value.`),
        args: args(`
      search_key (any) ${_lt("The value to search for. For example, 42, 'Cats', or I24.")}
      search_array (any, range) ${_lt("One method of using this function is to provide a single sorted row or column search_array to look through for the search_key with a second argument result_range. The other way is to combine these two arguments into one search_array where the first row or column is searched and a value is returned from the last row or column in the array. If search_key is not found, a non-exact match may be returned.")}
      result_range (any, range, optional) ${_lt("The range from which to return a result. The value returned corresponds to the location where search_key is found in search_range. This range must be only a single row or column and should not be used if using the search_result_array method.")}
  `),
        returns: ["ANY"],
        compute: function (search_key, search_array, result_range = undefined) {
            const verticalSearch = search_array[0].length >= search_array.length;
            const searchRange = (verticalSearch ? search_array[0] : search_array.map((c) => c[0])).map((el) => extractDateValue(el));
            const key = extractDateValue(search_key);
            const index = dichotomicPredecessorSearch(searchRange, key);
            if (index === -1) {
                const value = typeof search_key === "object" && search_key.jsDate
                    ? formatDateTime(search_key)
                    : search_key;
                throw new Error(_lt("Did not find value '%s' in LOOKUP evaluation.", value));
            }
            if (result_range === undefined) {
                return verticalSearch ? search_array.pop()[index] : search_array[index].pop();
            }
            const nbCol = result_range.length;
            const nbRow = result_range[0].length;
            if (nbCol > 1 && nbRow > 1) {
                throw new Error(_lt(`LOOKUP range must be a single row or a single column.`));
            }
            if (nbCol > 1) {
                if (nbCol - 1 < index) {
                    throw new Error(_lt("LOOKUP evaluates to an out of range row value %s.", (index + 1).toString()));
                }
                return result_range[index][0];
            }
            if (nbRow - 1 < index) {
                throw new Error(_lt("LOOKUP evaluates to an out of range column value %s.", (index + 1).toString()));
            }
            return result_range[0][index];
        },
    };
    // -----------------------------------------------------------------------------
    // MATCH
    // -----------------------------------------------------------------------------
    const MATCH = {
        description: _lt(`Position of item in range that matches value.`),
        args: args(`
      search_key (any) ${_lt("The value to search for. For example, 42, 'Cats', or I24.")}
      range (any, range) ${_lt("The one-dimensional array to be searched.")}
      search_type (number, optional, default=1) ${_lt("The search method. 1 (default) finds the largest value less than or equal to search_key when range is sorted in ascending order. 0 finds the exact value when range is unsorted. -1 finds the smallest value greater than or equal to search_key when range is sorted in descending order.")}
  `),
        returns: ["NUMBER"],
        compute: function (search_key, range, search_type = 1) {
            let _searchType = toNumber(search_type);
            const nbCol = range.length;
            const nbRow = range[0].length;
            if (nbCol > 1 && nbRow > 1) {
                throw new Error(_lt(`MATCH range must be a single row or a single column.`));
            }
            let index = -1;
            range = range.flat().map((el) => extractDateValue(el));
            const key = extractDateValue(search_key);
            _searchType = Math.sign(_searchType);
            switch (_searchType) {
                case 1:
                    index = dichotomicPredecessorSearch(range, key);
                    break;
                case 0:
                    index = linearSearch(range, key);
                    break;
                case -1:
                    index = dichotomicSuccessorSearch(range, key);
                    break;
            }
            if (index > -1) {
                return index + 1;
            }
            else {
                const value = typeof search_key === "object" && search_key.jsDate
                    ? formatDateTime(search_key)
                    : search_key;
                throw new Error(_lt("Did not find value '%s' in MATCH evaluation.", value));
            }
        },
    };
    // -----------------------------------------------------------------------------
    // VLOOKUP
    // -----------------------------------------------------------------------------
    const VLOOKUP = {
        description: _lt(`Vertical lookup.`),
        args: args(`
      search_key (any) ${_lt("The value to search for. For example, 42, 'Cats', or I24.")}
      range (any, range) ${_lt("The range to consider for the search. The first column in the range is searched for the key specified in search_key.")}
      index (number) ${_lt("The column index of the value to be returned, where the first column in range is numbered 1.")}
      is_sorted (boolean, optional, default = TRUE) ${_lt("Indicates whether the column to be searched [the first column of the specified range] is sorted, in which case the closest match for search_key will be returned.")}
  `),
        returns: ["ANY"],
        compute: function (search_key, range, index, is_sorted = true) {
            const _index = Math.trunc(toNumber(index));
            if (_index < 1 || range.length < _index) {
                throw new Error(_lt(`VLOOKUP evaluates to an out of bounds range.`));
            }
            const _isSorted = toBoolean(is_sorted);
            const firstCol = range[0].map((el) => extractDateValue(el));
            const key = extractDateValue(search_key);
            let lineIndex;
            if (_isSorted) {
                lineIndex = dichotomicPredecessorSearch(firstCol, key);
            }
            else {
                lineIndex = linearSearch(firstCol, key);
            }
            if (lineIndex > -1) {
                return range[_index - 1][lineIndex];
            }
            else {
                const value = typeof search_key === "object" && search_key.jsDate
                    ? formatDateTime(search_key)
                    : search_key;
                throw new Error(_lt("Did not find value '%s' in VLOOKUP evaluation.", value));
            }
        },
    };

    var lookup = /*#__PURE__*/Object.freeze({
        __proto__: null,
        LOOKUP: LOOKUP,
        MATCH: MATCH,
        VLOOKUP: VLOOKUP
    });

    // -----------------------------------------------------------------------------
    // ADD
    // -----------------------------------------------------------------------------
    const ADD = {
        description: _lt(`Sum of two numbers.`),
        args: args(`
      value1 (number) ${_lt("The first addend.")}
      value2 (number) ${_lt("The second addend.")}
    `),
        returns: ["NUMBER"],
        compute: function (value1, value2) {
            if (value1 && value1.value) {
                if (value2 && value2.value) {
                    return value1.value + value2.value;
                }
                return {
                    value: value1.value + toNumber(value2),
                    format: value1.format,
                    jsDate: numberToJsDate(value1.value + toNumber(value2)),
                };
            }
            return toNumber(value1) + toNumber(value2);
        },
    };
    // -----------------------------------------------------------------------------
    // CONCAT
    // -----------------------------------------------------------------------------
    const CONCAT = {
        description: _lt(`Concatenation of two values.`),
        args: args(`
      value1 (string) ${_lt("The value to which value2 will be appended.")}
      value2 (string) ${_lt("The value to append to value1.")}
    `),
        returns: ["STRING"],
        compute: function (value1, value2) {
            return toString(value1) + toString(value2);
        },
    };
    // -----------------------------------------------------------------------------
    // DIVIDE
    // -----------------------------------------------------------------------------
    const DIVIDE = {
        description: _lt(`One number divided by another.`),
        args: args(`
      dividend (number) ${_lt("The number to be divided.")}
      divisor (number) ${_lt("The number to divide by.")}
    `),
        returns: ["NUMBER"],
        compute: function (dividend, divisor) {
            const _divisor = toNumber(divisor);
            if (_divisor === 0) {
                throw new Error(_lt("Function DIVIDE parameter 2 cannot be zero."));
            }
            return toNumber(dividend) / _divisor;
        },
    };
    // -----------------------------------------------------------------------------
    // EQ
    // -----------------------------------------------------------------------------
    function isEmpty(value) {
        return value === null || value === undefined;
    }
    const getNeutral = { number: 0, string: "", boolean: false };
    const EQ = {
        description: _lt(`Equal.`),
        args: args(`
      value1 (any) ${_lt("The first value.")}
      value2 (any) ${_lt("The value to test against value1 for equality.")}
    `),
        returns: ["BOOLEAN"],
        compute: function (value1, value2) {
            value1 = isEmpty(value1) ? getNeutral[typeof value2] : value1;
            value2 = isEmpty(value2) ? getNeutral[typeof value1] : value2;
            if (typeof value1 === "string") {
                value1 = value1.toUpperCase();
            }
            if (typeof value2 === "string") {
                value2 = value2.toUpperCase();
            }
            value1 = extractDateValue(value1);
            value2 = extractDateValue(value2);
            return value1 === value2;
        },
    };
    // -----------------------------------------------------------------------------
    // GT
    // -----------------------------------------------------------------------------
    function applyRelationalOperator(value1, value2, cb) {
        value1 = isEmpty(value1) ? getNeutral[typeof value2] : value1;
        value2 = isEmpty(value2) ? getNeutral[typeof value1] : value2;
        value1 = extractDateValue(value1);
        value2 = extractDateValue(value2);
        if (typeof value1 !== "number") {
            value1 = toString(value1).toUpperCase();
        }
        if (typeof value2 !== "number") {
            value2 = toString(value2).toUpperCase();
        }
        const tV1 = typeof value1;
        const tV2 = typeof value2;
        if (tV1 === "string" && tV2 === "number") {
            return true;
        }
        if (tV2 === "string" && tV1 === "number") {
            return false;
        }
        return cb(value1, value2);
    }
    const GT = {
        description: _lt(`Strictly greater than.`),
        args: args(`
      value1 (any) ${_lt("The value to test as being greater than value2.")}
      value2 (any) ${_lt("The second value.")}
    `),
        returns: ["BOOLEAN"],
        compute: function (value1, value2) {
            return applyRelationalOperator(value1, value2, (v1, v2) => {
                return v1 > v2;
            });
        },
    };
    // -----------------------------------------------------------------------------
    // GTE
    // -----------------------------------------------------------------------------
    const GTE = {
        description: _lt(`Greater than or equal to.`),
        args: args(`
      value1 (any) ${_lt("The value to test as being greater than or equal to value2.")}
      value2 (any) ${_lt("The second value.")}
    `),
        returns: ["BOOLEAN"],
        compute: function (value1, value2) {
            return applyRelationalOperator(value1, value2, (v1, v2) => {
                return v1 >= v2;
            });
        },
    };
    // -----------------------------------------------------------------------------
    // LT
    // -----------------------------------------------------------------------------
    const LT = {
        description: _lt(`Less than.`),
        args: args(`
      value1 (any) ${_lt("The value to test as being less than value2.")}
      value2 (any) ${_lt("The second value.")}
    `),
        returns: ["BOOLEAN"],
        compute: function (value1, value2) {
            return !GTE.compute(value1, value2);
        },
    };
    // -----------------------------------------------------------------------------
    // LTE
    // -----------------------------------------------------------------------------
    const LTE = {
        description: _lt(`Less than or equal to.`),
        args: args(`
      value1 (any) ${_lt("The value to test as being less than or equal to value2.")}
      value2 (any) ${_lt("The second value.")}
    `),
        returns: ["BOOLEAN"],
        compute: function (value1, value2) {
            return !GT.compute(value1, value2);
        },
    };
    // -----------------------------------------------------------------------------
    // MINUS
    // -----------------------------------------------------------------------------
    const MINUS = {
        description: _lt(`Difference of two numbers.`),
        args: args(`
      value1 (number) ${_lt("The minuend, or number to be subtracted from.")}
      value2 (number) ${_lt("The subtrahend, or number to subtract from value1.")}
    `),
        returns: ["NUMBER"],
        compute: function (value1, value2) {
            return toNumber(value1) - toNumber(value2);
        },
    };
    // -----------------------------------------------------------------------------
    // MULTIPLY
    // -----------------------------------------------------------------------------
    const MULTIPLY = {
        description: _lt(`Product of two numbers`),
        args: args(`
      factor1 (number) ${_lt("The first multiplicand.")}
      factor2 (number) ${_lt("The second multiplicand.")}
    `),
        returns: ["NUMBER"],
        compute: function (factor1, factor2) {
            return toNumber(factor1) * toNumber(factor2);
        },
    };
    // -----------------------------------------------------------------------------
    // NE
    // -----------------------------------------------------------------------------
    const NE = {
        description: _lt(`Not equal.`),
        args: args(`
      value1 (any) ${_lt("The first value.")}
      value2 (any) ${_lt("The value to test against value1 for inequality.")}
    `),
        returns: ["BOOLEAN"],
        compute: function (value1, value2) {
            return !EQ.compute(value1, value2);
        },
    };
    // -----------------------------------------------------------------------------
    // POW
    // -----------------------------------------------------------------------------
    const POW = {
        description: _lt(`A number raised to a power.`),
        args: args(`
      base (number) ${_lt("The number to raise to the exponent power.")}
      exponent (number) ${_lt("The exponent to raise base to.")}
    `),
        returns: ["BOOLEAN"],
        compute: function (base, exponent) {
            return POWER.compute(base, exponent);
        },
    };
    // -----------------------------------------------------------------------------
    // UMINUS
    // -----------------------------------------------------------------------------
    const UMINUS = {
        description: _lt(`A number with the sign reversed.`),
        args: args(`
      value (number) ${_lt("The number to have its sign reversed. Equivalently, the number to multiply by -1.")}
    `),
        returns: ["NUMBER"],
        compute: function (value) {
            return -toNumber(value);
        },
    };
    // -----------------------------------------------------------------------------
    // UNARY_PERCENT
    // -----------------------------------------------------------------------------
    const UNARY_PERCENT = {
        description: _lt(`Value interpreted as a percentage.`),
        args: args(`
      percentage (number) ${_lt("The value to interpret as a percentage.")}
    `),
        returns: ["NUMBER"],
        compute: function (percentage) {
            return toNumber(percentage) / 100;
        },
    };
    // -----------------------------------------------------------------------------
    // UPLUS
    // -----------------------------------------------------------------------------
    const UPLUS = {
        description: _lt(`A specified number, unchanged.`),
        args: args(`
      value (any) ${_lt("The number to return.")}
    `),
        returns: ["ANY"],
        compute: function (value) {
            return value;
        },
    };

    var operators = /*#__PURE__*/Object.freeze({
        __proto__: null,
        ADD: ADD,
        CONCAT: CONCAT,
        DIVIDE: DIVIDE,
        EQ: EQ,
        GT: GT,
        GTE: GTE,
        LT: LT,
        LTE: LTE,
        MINUS: MINUS,
        MULTIPLY: MULTIPLY,
        NE: NE,
        POW: POW,
        UMINUS: UMINUS,
        UNARY_PERCENT: UNARY_PERCENT,
        UPLUS: UPLUS
    });

    // -----------------------------------------------------------------------------
    // CHAR
    // -----------------------------------------------------------------------------
    const CHAR = {
        description: _lt("Gets character associated with number."),
        args: args(`
      table_number (number) ${_lt("The number of the character to look up from the current Unicode table in decimal format.")}
  `),
        returns: ["STRING"],
        compute: function (table_number) {
            const _tableNumber = Math.trunc(toNumber(table_number));
            if (_tableNumber < 1) {
                throw new Error(_lt("Function CHAR parameter 1 value %s is out of range.", _tableNumber.toString()));
            }
            return String.fromCharCode(_tableNumber);
        },
    };
    // -----------------------------------------------------------------------------
    // CONCATENATE
    // -----------------------------------------------------------------------------
    const CONCATENATE = {
        description: _lt("Appends strings to one another."),
        args: args(`
      string1 (string, range<string>) ${_lt("The initial string.")}
      string2 (string, range<string>, optional, repeating) ${_lt("More strings to append in sequence.")}
  `),
        returns: ["STRING"],
        compute: function () {
            return reduceArgs(arguments, (acc, a) => acc + toString(a), "");
        },
    };
    // -----------------------------------------------------------------------------
    // EXACT
    // -----------------------------------------------------------------------------
    const EXACT = {
        description: _lt("Tests whether two strings are identical."),
        args: args(`
      string1 (string) ${_lt("The first string to compare.")}
      string2 (string) ${_lt("The second string to compare.")}
  `),
        returns: ["BOOLEAN"],
        compute: function (string1, string2) {
            return toString(string1) === toString(string2);
        },
    };
    // -----------------------------------------------------------------------------
    // FIND
    // -----------------------------------------------------------------------------
    const FIND = {
        description: _lt("First position of string found in text, case-sensitive."),
        args: args(`
      search_for (string) ${_lt("The string to look for within text_to_search.")}
      text_to_search (string) ${_lt("The text to search for the first occurrence of search_for.")}
      starting_at (number, optional, default=1 ) ${_lt("The character within text_to_search at which to start the search.")}
  `),
        returns: ["NUMBER"],
        compute: function (search_for, text_to_search, starting_at = 1) {
            const _textToSearch = toString(text_to_search);
            if (_textToSearch === "") {
                throw new Error(_lt(`Function FIND parameter 2 value should be non-empty.`));
            }
            const _startingAt = toNumber(starting_at);
            if (_startingAt === 0) {
                throw new Error(_lt(`Function FIND parameter 3 value is 0. It should be greater than or equal to 1.`));
            }
            const _searchFor = toString(search_for);
            const result = _textToSearch.indexOf(_searchFor, _startingAt - 1);
            if (result < 0) {
                throw new Error(_lt("In FIND evaluation, cannot find '%s' within '%s'.", _searchFor.toString(), _textToSearch));
            }
            return result + 1;
        },
    };
    // -----------------------------------------------------------------------------
    // JOIN
    // -----------------------------------------------------------------------------
    const JOIN = {
        description: _lt("Concatenates elements of arrays with delimiter."),
        args: args(`
      delimiter (string) ${_lt("The character or string to place between each concatenated value.")}
      value_or_array1 (string, range<string>) ${_lt("The value or values to be appended using delimiter.")}
      value_or_array2 (string, range<string>, optional, repeating) ${_lt("More values to be appended using delimiter.")}
  `),
        returns: ["STRING"],
        compute: function (delimiter, ...values_or_arrays) {
            const _delimiter = toString(delimiter);
            return reduceArgs(values_or_arrays, (acc, a) => (acc ? acc + _delimiter : "") + toString(a), "");
        },
    };
    // -----------------------------------------------------------------------------
    // LEFT
    // -----------------------------------------------------------------------------
    const LEFT = {
        description: _lt("Substring from beginning of specified string."),
        args: args(`
      text (string) ${_lt("The string from which the left portion will be returned.")}
      number_of_characters (number, optional, default=1) ${_lt("The number of characters to return from the left side of string.")}
  `),
        returns: ["STRING"],
        compute: function (text, number_of_characters = 1) {
            const _numberOfCharacters = toNumber(number_of_characters);
            if (_numberOfCharacters < 0) {
                throw new Error(_lt(`Function LEFT parameter 2 value is negative. It should be positive or zero.`));
            }
            return toString(text).substring(0, _numberOfCharacters);
        },
    };
    // -----------------------------------------------------------------------------
    // LEN
    // -----------------------------------------------------------------------------
    const LEN = {
        description: _lt("Length of a string."),
        args: args(`
      text (string) ${_lt("The string whose length will be returned.")}
  `),
        returns: ["NUMBER"],
        compute: function (text) {
            return toString(text).length;
        },
    };
    // -----------------------------------------------------------------------------
    // LOWER
    // -----------------------------------------------------------------------------
    const LOWER = {
        description: _lt("Converts a specified string to lowercase."),
        args: args(`
      text (string) ${_lt("The string to convert to lowercase.")}
  `),
        returns: ["STRING"],
        compute: function (text) {
            return toString(text).toLowerCase();
        },
    };
    // -----------------------------------------------------------------------------
    // REPLACE
    // -----------------------------------------------------------------------------
    const REPLACE = {
        description: _lt("Replaces part of a text string with different text."),
        args: args(`
      text (string) ${_lt("The text, a part of which will be replaced.")}
      position (number) ${_lt("The position where the replacement will begin (starting from 1).")}
      length (number) ${_lt("The number of characters in the text to be replaced.")}
      new_text (string) ${_lt("The text which will be inserted into the original text.")}
  `),
        returns: ["STRING"],
        compute: function (text, position, length, new_text) {
            const _position = toNumber(position);
            if (_position < 1) {
                throw new Error(_lt("Function REPLACE parameter 2 value is %s. It should be greater than or equal to 1.", toString(_position)));
            }
            const _text = toString(text);
            const _length = toNumber(length);
            const _newText = toString(new_text);
            return _text.substring(0, _position - 1) + _newText + _text.substring(_position - 1 + _length);
        },
    };
    // -----------------------------------------------------------------------------
    // RIGHT
    // -----------------------------------------------------------------------------
    const RIGHT = {
        description: _lt("A substring from the end of a specified string."),
        args: args(`
      text (string) ${_lt("The string from which the right portion will be returned.")}
      number_of_characters (number, optional, default=1) ${_lt("The number of characters to return from the right side of string.")}
  `),
        returns: ["STRING"],
        compute: function (text, number_of_characters = 1) {
            const _numberOfCharacters = toNumber(number_of_characters);
            if (_numberOfCharacters < 0) {
                throw new Error(_lt(`Function RIGHT parameter 2 value is negative. It should be positive or zero.`));
            }
            const _text = toString(text);
            const stringLength = _text.length;
            return _text.substring(stringLength - _numberOfCharacters, stringLength);
        },
    };
    // -----------------------------------------------------------------------------
    // SEARCH
    // -----------------------------------------------------------------------------
    const SEARCH = {
        description: _lt("First position of string found in text, ignoring case."),
        args: args(`
      search_for (string) ${_lt("The string to look for within text_to_search.")}
      text_to_search (string) ${_lt("The text to search for the first occurrence of search_for.")}
      starting_at (number, optional, default=1 ) ${_lt("The character within text_to_search at which to start the search.")}
  `),
        returns: ["NUMBER"],
        compute: function (search_for, text_to_search, starting_at = 1) {
            const _textToSearch = toString(text_to_search).toLowerCase();
            if (_textToSearch === "") {
                throw new Error(_lt(`Function SEARCH parameter 2 value should be non-empty.`));
            }
            const _startingAt = toNumber(starting_at);
            if (_startingAt === 0) {
                throw new Error(_lt(`Function SEARCH parameter 3 value is 0. It should be greater than or equal to 1.`));
            }
            const _searchFor = toString(search_for).toLowerCase();
            const result = _textToSearch.indexOf(_searchFor, _startingAt - 1);
            if (result < 0) {
                throw new Error(_lt("In SEARCH evaluation, cannot find '%s' within '%s'.", _searchFor, _textToSearch));
            }
            return result + 1;
        },
    };
    // -----------------------------------------------------------------------------
    // SUBSTITUTE
    // -----------------------------------------------------------------------------
    const SUBSTITUTE = {
        description: _lt("Replaces existing text with new text in a string."),
        args: args(`
      text_to_search (string) ${_lt("The text within which to search and replace.")}
      search_for (string) ${_lt("The string to search for within text_to_search.")}
      replace_with (string) ${_lt("The string that will replace search_for.")}
      occurrence_number (number, optional) ${_lt("The instance of search_for within text_to_search to replace with replace_with. By default, all occurrences of search_for are replaced; however, if occurrence_number is specified, only the indicated instance of search_for is replaced.")}
  `),
        returns: ["NUMBER"],
        compute: function (text_to_search, search_for, replace_with, occurrence_number = undefined) {
            const _occurrenceNumber = toNumber(occurrence_number);
            if (_occurrenceNumber < 0) {
                throw new Error(_lt(`Function SUBSTITUTE parameter 4 value is negative. It should be positive or zero.`));
            }
            const _textToSearch = toString(text_to_search);
            const _searchFor = toString(search_for);
            if (_searchFor === "") {
                return _textToSearch;
            }
            const _replaceWith = toString(replace_with);
            const reg = new RegExp(_searchFor, "g");
            if (_occurrenceNumber === 0) {
                return _textToSearch.replace(reg, _replaceWith);
            }
            let n = 0;
            return _textToSearch.replace(reg, (text) => (++n === _occurrenceNumber ? _replaceWith : text));
        },
    };
    // -----------------------------------------------------------------------------
    // TEXTJOIN
    // -----------------------------------------------------------------------------
    const TEXTJOIN = {
        description: _lt("Combines text from multiple strings and/or arrays."),
        args: args(`
      delimiter (string) ${_lt(" A string, possible empty, or a reference to a valid string. If empty, the text will be simply concatenated.")}
      ignore_empty (boolean) ${_lt("A boolean; if TRUE, empty cells selected in the text arguments won't be included in the result.")}
      text1 (string, range<string>) ${_lt("Any text item. This could be a string, or an array of strings in a range.")}
      text2 (string, range<string>, optional, repeating) ${_lt("Additional text item(s).")}
  `),
        returns: ["STRING"],
        compute: function (delimiter, ignore_empty, ...texts_or_arrays) {
            const _delimiter = toString(delimiter);
            const _ignoreEmpty = toBoolean(ignore_empty);
            let n = 0;
            return reduceArgs(texts_or_arrays, (acc, a) => !(_ignoreEmpty && toString(a) === "") ? (n++ ? acc + _delimiter : "") + toString(a) : acc, "");
        },
    };
    // -----------------------------------------------------------------------------
    // TRIM
    // -----------------------------------------------------------------------------
    const TRIM = {
        description: _lt("Removes space characters."),
        args: args(`
      text (string) ${_lt("The text or reference to a cell containing text to be trimmed.")}
  `),
        returns: ["STRING"],
        compute: function (text) {
            return toString(text).trim();
        },
    };
    // -----------------------------------------------------------------------------
    // UPPER
    // -----------------------------------------------------------------------------
    const UPPER = {
        description: _lt("Converts a specified string to uppercase."),
        args: args(`
      text (string) ${_lt("The string to convert to uppercase.")}
  `),
        returns: ["STRING"],
        compute: function (text) {
            return toString(text).toUpperCase();
        },
    };

    var text = /*#__PURE__*/Object.freeze({
        __proto__: null,
        CHAR: CHAR,
        CONCATENATE: CONCATENATE,
        EXACT: EXACT,
        FIND: FIND,
        JOIN: JOIN,
        LEFT: LEFT,
        LEN: LEN,
        LOWER: LOWER,
        REPLACE: REPLACE,
        RIGHT: RIGHT,
        SEARCH: SEARCH,
        SUBSTITUTE: SUBSTITUTE,
        TEXTJOIN: TEXTJOIN,
        TRIM: TRIM,
        UPPER: UPPER
    });

    const functions$4 = {
        database,
        date,
        info,
        lookup,
        logical,
        math,
        operators,
        statistical,
        text,
    };
    //------------------------------------------------------------------------------
    // Function registry
    //------------------------------------------------------------------------------
    class FunctionRegistry extends Registry {
        constructor() {
            super(...arguments);
            this.mapping = {};
        }
        add(name, descr) {
            name = name.toUpperCase().replace("_", ".");
            validateArguments(descr.args);
            this.mapping[name] = descr.compute;
            super.add(name, descr);
            return this;
        }
    }
    const functionRegistry = new FunctionRegistry();
    for (let category in functions$4) {
        const fns = functions$4[category];
        for (let name in fns) {
            const descr = fns[name];
            descr.category = category;
            functionRegistry.add(name, descr);
        }
    }

    /**
     * BasePlugin
     *
     * Since the spreadsheet internal state is quite complex, it is split into
     * multiple parts, each managing a specific concern.
     *
     * This file introduce the BasePlugin, which is the common class that defines
     * how each of these model sub parts should interact with each other.
     */
    class BasePlugin {
        constructor(workbook, getters, history, dispatch, config) {
            this.workbook = workbook;
            this.getters = getters;
            this.history = Object.assign(Object.create(history), {
                updateLocalState: history.updateStateFromRoot.bind(history, this),
            });
            this.dispatch = dispatch;
            this.currentMode = config.mode;
            this.ui = config;
        }
        // ---------------------------------------------------------------------------
        // Command handling
        // ---------------------------------------------------------------------------
        /**
         * Before a command is accepted, the model will ask each plugin if the command
         * is allowed.  If all of then return true, then we can proceed. Otherwise,
         * the command is cancelled.
         *
         * There should not be any side effects in this method.
         */
        allowDispatch(command) {
            return { status: "SUCCESS" };
        }
        /**
         * This method is useful when a plugin need to perform some action before a
         * command is handled in another plugin. This should only be used if it is not
         * possible to do the work in the handle method.
         */
        beforeHandle(command) { }
        /**
         * This is the standard place to handle any command. Most of the plugin
         * command handling work should take place here.
         */
        handle(command) { }
        /**
         * Sometimes, it is useful to perform some work after a command (and all its
         * subcommands) has been completely handled.  For example, when we paste
         * multiple cells, we only want to reevaluate the cell values once at the end.
         */
        finalize(command) { }
        // ---------------------------------------------------------------------------
        // Grid rendering
        // ---------------------------------------------------------------------------
        drawGrid(ctx, layer) { }
        // ---------------------------------------------------------------------------
        // Import/Export
        // ---------------------------------------------------------------------------
        import(data) { }
        export(data) { }
    }
    BasePlugin.layers = [];
    BasePlugin.getters = [];
    BasePlugin.modes = ["headless", "normal", "readonly"];

    const autofillModifiersRegistry = new Registry();
    autofillModifiersRegistry
        .add("INCREMENT_MODIFIER", {
        apply: (rule, data) => {
            rule.current += rule.increment;
            const content = (parseFloat(data.content) + rule.current).toString();
            return {
                cellData: Object.assign({}, data, { content }),
                tooltip: content ? { props: { content } } : undefined,
            };
        },
    })
        .add("COPY_MODIFIER", {
        apply: (rule, data) => {
            return {
                cellData: data,
                tooltip: data.content ? { props: { content: data.content } } : undefined,
            };
        },
    })
        .add("FORMULA_MODIFIER", {
        apply: (rule, data, getters, direction) => {
            rule.current += rule.increment;
            let x = 0;
            let y = 0;
            switch (direction) {
                case 0 /* UP */:
                    x = 0;
                    y = -rule.current;
                    break;
                case 1 /* DOWN */:
                    x = 0;
                    y = rule.current;
                    break;
                case 2 /* LEFT */:
                    x = -rule.current;
                    y = 0;
                    break;
                case 3 /* RIGHT */:
                    x = rule.current;
                    y = 0;
                    break;
            }
            const content = getters.applyOffset(data.content, x, y);
            return {
                cellData: Object.assign({}, data, { content }),
                tooltip: content ? { props: { content } } : undefined,
            };
        },
    });

    const autofillRulesRegistry = new Registry();
    /**
     * Get the consecutive xc that are of type "number".
     * Return the one which contains the given cell
     */
    function getGroup(cell, cells) {
        let group = [];
        let found = false;
        for (let x of cells) {
            if (x === cell) {
                found = true;
            }
            if (!x || x.type !== "number") {
                if (found) {
                    return group;
                }
                group = [];
            }
            if (x && x.type === "number" && x.content) {
                group.push(x.content);
            }
        }
        return group;
    }
    /**
     * Get the average steps between numbers
     */
    function getAverageIncrement(group) {
        const averages = [];
        let last = parseFloat(group[0]);
        for (let i = 1; i < group.length; i++) {
            const current = parseFloat(group[i]);
            averages.push(current - last);
            last = current;
        }
        return averages.reduce((a, b) => a + b, 0) / averages.length;
    }
    autofillRulesRegistry
        .add("simple_value_copy", {
        condition: (cell, cells) => {
            return cells.length === 1 && ["text", "date", "number"].includes(cell.type);
        },
        generateRule: () => {
            return { type: "COPY_MODIFIER" };
        },
        sequence: 10,
    })
        .add("copy_text", {
        condition: (cell) => cell.type === "text",
        generateRule: () => {
            return { type: "COPY_MODIFIER" };
        },
        sequence: 20,
    })
        .add("update_formula", {
        condition: (cell) => cell.type === "formula",
        generateRule: (_, cells) => {
            return { type: "FORMULA_MODIFIER", increment: cells.length, current: 0 };
        },
        sequence: 30,
    })
        .add("increment_number", {
        condition: (cell) => cell.type === "number",
        generateRule: (cell, cells) => {
            const group = getGroup(cell, cells);
            let increment = 1;
            if (group.length == 2) {
                increment = (parseFloat(group[1]) - parseFloat(group[0])) * 2;
            }
            else if (group.length > 2) {
                increment = getAverageIncrement(group) * group.length;
            }
            return {
                type: "INCREMENT_MODIFIER",
                increment,
                current: 0,
            };
        },
        sequence: 40,
    });

    const { xml: xml$i, css: css$i } = owl.tags;
    const { useRef: useRef$5 } = owl.hooks;
    const TEMPLATE$f = xml$i /* xml */ `
<div class="o-chart-container">
    <canvas t-ref="graphContainer" />
</div>`;
    // -----------------------------------------------------------------------------
    // STYLE
    // -----------------------------------------------------------------------------
    const CSS$f = css$i /* scss */ `
  .o-chart-container {
    width: 100%;
    height: 100%;
    position: relative;

    > canvas {
      background-color: white;
    }
  }
`;
    class ChartFigure extends owl.Component {
        constructor() {
            super(...arguments);
            this.canvas = useRef$5("graphContainer");
        }
        mounted() {
            this.createChart();
        }
        patched() {
            const figure = this.props.figure;
            const chartData = this.env.getters.getChartRuntime(figure.id);
            if (chartData) {
                if (chartData.data && chartData.data.datasets) {
                    Object.assign(this.chart.data.datasets, chartData.data.datasets);
                    Object.assign(this.chart.data.labels, chartData.data.labels);
                }
                else {
                    this.chart.data.datasets = undefined;
                }
                this.chart.update({ duration: 0 });
            }
            else {
                this.chart && this.chart.destroy();
            }
        }
        createChart() {
            const figure = this.props.figure;
            const charData = this.env.getters.getChartRuntime(figure.id);
            if (charData) {
                const canvas = this.canvas.el;
                const ctx = canvas.getContext("2d");
                this.chart = new window.Chart(ctx, charData);
            }
        }
    }
    ChartFigure.template = TEMPLATE$f;
    ChartFigure.style = CSS$f;
    ChartFigure.components = {};

    const { xml: xml$h, css: css$h } = owl.tags;
    const TEMPLATE$e = xml$h /* xml */ `
  <div class="o-fig-text">
    <p t-esc="props.figure.data"/>
  </div>
`;
    // -----------------------------------------------------------------------------
    // STYLE
    // -----------------------------------------------------------------------------
    const CSS$e = css$h /* scss */ `
  .o-fig-text {
    width: 100%;
    height: 100%;
    margin: 0px;
    background-color: #eee;
    position: absolute;

    > p {
      margin: 5px;
    }
  }
`;
    class TextFigure extends owl.Component {
    }
    TextFigure.template = TEMPLATE$e;
    TextFigure.style = CSS$e;

    const figureRegistry = new Registry();
    // figureRegistry.add("ConditionalFormatting", {
    //   title: "Conditional formatting",
    //   Body: ConditionalFormattingPanel,
    // });
    //
    figureRegistry.add("text", { Component: TextFigure });
    figureRegistry.add("chart", { Component: ChartFigure, SidePanelComponent: "ChartPanel" });

    const DEFAULT_MENU_ITEM = (key) => ({
        isVisible: () => true,
        isEnabled: () => true,
        action: false,
        children: [],
        separator: false,
        id: key,
    });
    function createFullMenuItem(key, value) {
        return Object.assign({}, DEFAULT_MENU_ITEM(key), value);
    }
    /**
     * The class Registry is extended in order to add the function addChild
     *
     */
    class MenuItemRegistry extends Registry {
        /**
         * @override
         */
        add(key, value) {
            this.content[key] = createFullMenuItem(key, value);
            return this;
        }
        /**
         * Add a subitem to an existing item
         * @param path Path of items to add this subitem
         * @param value Subitem to add
         */
        addChild(key, path, value) {
            const root = path.splice(0, 1)[0];
            let node = this.content[root];
            if (!node) {
                throw new Error(`Path ${root + ":" + path.join(":")} not found`);
            }
            for (let p of path) {
                if (typeof node.children === "function") {
                    node = undefined;
                }
                else {
                    node = node.children.find((elt) => elt.id === p);
                }
                if (!node) {
                    throw new Error(`Path ${root + ":" + path.join(":")} not found`);
                }
            }
            node.children.push(createFullMenuItem(key, value));
            return this;
        }
        getChildren(node, env) {
            if (typeof node.children === "function") {
                return node.children(env).sort((a, b) => a.sequence - b.sequence);
            }
            return node.children.sort((a, b) => a.sequence - b.sequence);
        }
        getName(node, env) {
            if (typeof node.name === "function") {
                return node.name(env);
            }
            return node.name;
        }
        /**
         * Get a list of all elements in the registry, ordered by sequence
         * @override
         */
        getAll() {
            return super.getAll().sort((a, b) => a.sequence - b.sequence);
        }
    }

    //------------------------------------------------------------------------------
    // Helpers
    //------------------------------------------------------------------------------
    function getColumnsNumber(env) {
        const activeCols = env.getters.getActiveCols();
        if (activeCols.size) {
            return activeCols.size;
        }
        else {
            const zone = env.getters.getSelectedZones()[0];
            return zone.right - zone.left + 1;
        }
    }
    function getRowsNumber(env) {
        const activeRows = env.getters.getActiveRows();
        if (activeRows.size) {
            return activeRows.size;
        }
        else {
            const zone = env.getters.getSelectedZones()[0];
            return zone.bottom - zone.top + 1;
        }
    }
    function setFormatter(env, formatter) {
        env.dispatch("SET_FORMATTER", {
            sheet: env.getters.getActiveSheet(),
            target: env.getters.getSelectedZones(),
            formatter,
        });
    }
    function setStyle(env, style) {
        env.dispatch("SET_FORMATTING", {
            sheet: env.getters.getActiveSheet(),
            target: env.getters.getSelectedZones(),
            style,
        });
    }
    //------------------------------------------------------------------------------
    // Simple actions
    //------------------------------------------------------------------------------
    const UNDO_ACTION = (env) => env.dispatch("UNDO");
    const REDO_ACTION = (env) => env.dispatch("REDO");
    const COPY_ACTION = async (env) => {
        env.dispatch("COPY", { target: env.getters.getSelectedZones() });
        await env.clipboard.writeText(env.getters.getClipboardContent());
    };
    const CUT_ACTION = async (env) => {
        env.dispatch("CUT", { target: env.getters.getSelectedZones() });
        await env.clipboard.writeText(env.getters.getClipboardContent());
    };
    const PASTE_ACTION = async (env) => {
        const spreadsheetClipboard = env.getters.getClipboardContent();
        let osClipboard;
        try {
            osClipboard = await env.clipboard.readText();
        }
        catch (e) {
            // Permission is required to read the clipboard.
            console.warn("The OS clipboard could not be read.");
            console.error(e);
        }
        const target = env.getters.getSelectedZones();
        if (osClipboard && osClipboard !== spreadsheetClipboard) {
            env.dispatch("PASTE_FROM_OS_CLIPBOARD", {
                target,
                text: osClipboard,
            });
        }
        else {
            env.dispatch("PASTE", { target, interactive: true });
        }
    };
    const PASTE_VALUE_ACTION = (env) => env.dispatch("PASTE", { target: env.getters.getSelectedZones(), onlyValue: true });
    const PASTE_FORMAT_ACTION = (env) => env.dispatch("PASTE", { target: env.getters.getSelectedZones(), onlyFormat: true });
    const DELETE_CONTENT_ACTION = (env) => env.dispatch("DELETE_CONTENT", {
        sheet: env.getters.getActiveSheet(),
        target: env.getters.getSelectedZones(),
    });
    const SET_FORMULA_VISIBILITY_ACTION = (env) => env.dispatch("SET_FORMULA_VISIBILITY", { show: !env.getters.shouldShowFormulas() });
    //------------------------------------------------------------------------------
    // Grid manipulations
    //------------------------------------------------------------------------------
    const DELETE_CONTENT_ROWS_NAME = (env) => {
        let first;
        let last;
        const activesRows = env.getters.getActiveRows();
        if (activesRows.size !== 0) {
            first = Math.min(...activesRows);
            last = Math.max(...activesRows);
        }
        else {
            const zone = env.getters.getSelectedZones()[0];
            first = zone.top;
            last = zone.bottom;
        }
        if (first === last) {
            return _lt("Clear row %s", (first + 1).toString());
        }
        return _lt("Clear rows %s - %s", (first + 1).toString(), (last + 1).toString());
    };
    const DELETE_CONTENT_ROWS_ACTION = (env) => {
        const target = [...env.getters.getActiveRows()].map((index) => env.getters.getRowsZone(index, index));
        env.dispatch("DELETE_CONTENT", {
            target,
            sheet: env.getters.getActiveSheet(),
        });
    };
    const DELETE_CONTENT_COLUMNS_NAME = (env) => {
        let first;
        let last;
        const activeCols = env.getters.getActiveCols();
        if (activeCols.size !== 0) {
            first = Math.min(...activeCols);
            last = Math.max(...activeCols);
        }
        else {
            const zone = env.getters.getSelectedZones()[0];
            first = zone.left;
            last = zone.right;
        }
        if (first === last) {
            return _lt("Clear column %s", numberToLetters(first));
        }
        return _lt("Clear columns %s - %s", numberToLetters(first), numberToLetters(last));
    };
    const DELETE_CONTENT_COLUMNS_ACTION = (env) => {
        const target = [...env.getters.getActiveCols()].map((index) => env.getters.getColsZone(index, index));
        env.dispatch("DELETE_CONTENT", {
            target,
            sheet: env.getters.getActiveSheet(),
        });
    };
    const REMOVE_ROWS_NAME = (env) => {
        let first;
        let last;
        const activesRows = env.getters.getActiveRows();
        if (activesRows.size !== 0) {
            first = Math.min(...activesRows);
            last = Math.max(...activesRows);
        }
        else {
            const zone = env.getters.getSelectedZones()[0];
            first = zone.top;
            last = zone.bottom;
        }
        if (first === last) {
            return _lt("Delete row %s", (first + 1).toString());
        }
        return _lt("Delete rows %s - %s", (first + 1).toString(), (last + 1).toString());
    };
    const REMOVE_ROWS_ACTION = (env) => {
        let rows = [...env.getters.getActiveRows()];
        if (!rows.length) {
            const zone = env.getters.getSelectedZones()[0];
            for (let i = zone.top; i <= zone.bottom; i++) {
                rows.push(i);
            }
        }
        env.dispatch("REMOVE_ROWS", {
            sheet: env.getters.getActiveSheet(),
            rows,
        });
    };
    const REMOVE_COLUMNS_NAME = (env) => {
        let first;
        let last;
        const activeCols = env.getters.getActiveCols();
        if (activeCols.size !== 0) {
            first = Math.min(...activeCols);
            last = Math.max(...activeCols);
        }
        else {
            const zone = env.getters.getSelectedZones()[0];
            first = zone.left;
            last = zone.right;
        }
        if (first === last) {
            return _lt("Delete column %s", numberToLetters(first));
        }
        return _lt("Delete columns %s - %s", numberToLetters(first), numberToLetters(last));
    };
    const REMOVE_COLUMNS_ACTION = (env) => {
        let columns = [...env.getters.getActiveCols()];
        if (!columns.length) {
            const zone = env.getters.getSelectedZones()[0];
            for (let i = zone.left; i <= zone.right; i++) {
                columns.push(i);
            }
        }
        env.dispatch("REMOVE_COLUMNS", {
            sheet: env.getters.getActiveSheet(),
            columns,
        });
    };
    const MENU_INSERT_ROWS_BEFORE_NAME = (env) => {
        const number = getRowsNumber(env);
        if (number === 1) {
            return _lt("Row above");
        }
        return _lt("%s Rows above", number.toString());
    };
    const ROW_INSERT_ROWS_BEFORE_NAME = (env) => {
        const number = getRowsNumber(env);
        return number === 1 ? _lt("Insert row above") : _lt("Insert %s rows above", number.toString());
    };
    const CELL_INSERT_ROWS_BEFORE_NAME = (env) => {
        const number = getRowsNumber(env);
        if (number === 1) {
            return _lt("Insert row");
        }
        return _lt("Insert %s rows", number.toString());
    };
    const INSERT_ROWS_BEFORE_ACTION = (env) => {
        const activeRows = env.getters.getActiveRows();
        let row;
        let quantity;
        if (activeRows.size) {
            row = Math.min(...activeRows);
            quantity = activeRows.size;
        }
        else {
            const zone = env.getters.getSelectedZones()[0];
            row = zone.top;
            quantity = zone.bottom - zone.top + 1;
        }
        env.dispatch("ADD_ROWS", {
            sheet: env.getters.getActiveSheet(),
            position: "before",
            row,
            quantity,
        });
    };
    const MENU_INSERT_ROWS_AFTER_NAME = (env) => {
        const number = getRowsNumber(env);
        if (number === 1) {
            return _lt("Row below");
        }
        return _lt("%s Rows below", number.toString());
    };
    const ROW_INSERT_ROWS_AFTER_NAME = (env) => {
        const number = getRowsNumber(env);
        return number === 1 ? _lt("Insert row below") : _lt("Insert %s rows below", number.toString());
    };
    const INSERT_ROWS_AFTER_ACTION = (env) => {
        const activeRows = env.getters.getActiveRows();
        let row;
        let quantity;
        if (activeRows.size) {
            row = Math.max(...activeRows);
            quantity = activeRows.size;
        }
        else {
            const zone = env.getters.getSelectedZones()[0];
            row = zone.bottom;
            quantity = zone.bottom - zone.top + 1;
        }
        env.dispatch("ADD_ROWS", {
            sheet: env.getters.getActiveSheet(),
            position: "after",
            row,
            quantity,
        });
    };
    const MENU_INSERT_COLUMNS_BEFORE_NAME = (env) => {
        const number = getColumnsNumber(env);
        if (number === 1) {
            return _lt("Column left");
        }
        return _lt("%s Columns left", number.toString());
    };
    const COLUMN_INSERT_COLUMNS_BEFORE_NAME = (env) => {
        const number = getColumnsNumber(env);
        return number === 1
            ? _lt("Insert column left")
            : _lt("Insert %s columns left", number.toString());
    };
    const CELL_INSERT_COLUMNS_BEFORE_NAME = (env) => {
        const number = getColumnsNumber(env);
        if (number === 1) {
            return _lt("Insert column");
        }
        return _lt("Insert %s columns", number.toString());
    };
    const INSERT_COLUMNS_BEFORE_ACTION = (env) => {
        const activeCols = env.getters.getActiveCols();
        let column;
        let quantity;
        if (activeCols.size) {
            column = Math.min(...activeCols);
            quantity = activeCols.size;
        }
        else {
            const zone = env.getters.getSelectedZones()[0];
            column = zone.left;
            quantity = zone.right - zone.left + 1;
        }
        env.dispatch("ADD_COLUMNS", {
            sheet: env.getters.getActiveSheet(),
            position: "before",
            column,
            quantity,
        });
    };
    const MENU_INSERT_COLUMNS_AFTER_NAME = (env) => {
        const number = getColumnsNumber(env);
        if (number === 1) {
            return _lt("Column right");
        }
        return _lt("%s Columns right", number.toString());
    };
    const COLUMN_INSERT_COLUMNS_AFTER_NAME = (env) => {
        const number = getColumnsNumber(env);
        return number === 1
            ? _lt("Insert column right")
            : _lt("Insert %s columns right", number.toString());
    };
    const INSERT_COLUMNS_AFTER_ACTION = (env) => {
        const activeCols = env.getters.getActiveCols();
        let column;
        let quantity;
        if (activeCols.size) {
            column = Math.max(...activeCols);
            quantity = activeCols.size;
        }
        else {
            const zone = env.getters.getSelectedZones()[0];
            column = zone.right;
            quantity = zone.right - zone.left + 1;
        }
        env.dispatch("ADD_COLUMNS", {
            sheet: env.getters.getActiveSheet(),
            position: "after",
            column,
            quantity,
        });
    };
    //------------------------------------------------------------------------------
    // Sheets
    //------------------------------------------------------------------------------
    const CREATE_SHEET_ACTION = (env) => {
        env.dispatch("CREATE_SHEET", { activate: true, id: uuidv4() });
    };
    //------------------------------------------------------------------------------
    // Charts
    //------------------------------------------------------------------------------
    const CREATE_CHART = (env) => {
        env.openSidePanel("ChartPanel");
    };
    //------------------------------------------------------------------------------
    // Style/Format
    //------------------------------------------------------------------------------
    const FORMAT_AUTO_ACTION = (env) => setFormatter(env, "");
    const FORMAT_NUMBER_ACTION = (env) => setFormatter(env, "#,##0.00");
    const FORMAT_PERCENT_ACTION = (env) => setFormatter(env, "0.00%");
    const FORMAT_DATE_ACTION = (env) => setFormatter(env, "m/d/yyyy");
    const FORMAT_TIME_ACTION = (env) => setFormatter(env, "hh:mm:ss a");
    const FORMAT_DATE_TIME_ACTION = (env) => setFormatter(env, "m/d/yyyy hh:mm:ss");
    const FORMAT_DURATION_ACTION = (env) => setFormatter(env, "hhhh:mm:ss");
    const FORMAT_BOLD_ACTION = (env) => setStyle(env, { bold: !env.getters.getCurrentStyle().bold });
    const FORMAT_ITALIC_ACTION = (env) => setStyle(env, { italic: !env.getters.getCurrentStyle().italic });
    const FORMAT_STRIKETHROUGH_ACTION = (env) => setStyle(env, { strikethrough: !env.getters.getCurrentStyle().strikethrough });
    //------------------------------------------------------------------------------
    // Side panel
    //------------------------------------------------------------------------------
    const OPEN_CF_SIDEPANEL_ACTION = (env) => {
        env.openSidePanel("ConditionalFormatting", { selection: env.getters.getSelectedZones() });
    };

    //------------------------------------------------------------------------------
    // Context Menu Registry
    //------------------------------------------------------------------------------
    const cellMenuRegistry = new MenuItemRegistry();
    cellMenuRegistry
        .add("cut", {
        name: _lt("Cut"),
        sequence: 10,
        action: CUT_ACTION,
    })
        .add("copy", {
        name: _lt("Copy"),
        sequence: 20,
        action: COPY_ACTION,
    })
        .add("paste", {
        name: _lt("Paste"),
        sequence: 30,
        action: PASTE_ACTION,
    })
        .add("paste_special", {
        name: _lt("Paste special"),
        sequence: 40,
        separator: true,
    })
        .addChild("paste_value_only", ["paste_special"], {
        name: _lt("Paste values only"),
        sequence: 10,
        action: PASTE_VALUE_ACTION,
    })
        .addChild("paste_format_only", ["paste_special"], {
        name: _lt("Paste format only"),
        sequence: 20,
        action: PASTE_FORMAT_ACTION,
    })
        .add("add_row_before", {
        name: CELL_INSERT_ROWS_BEFORE_NAME,
        sequence: 50,
        action: INSERT_ROWS_BEFORE_ACTION,
    })
        .add("add_column_before", {
        name: CELL_INSERT_COLUMNS_BEFORE_NAME,
        sequence: 70,
        action: INSERT_COLUMNS_BEFORE_ACTION,
        separator: true,
    })
        .add("delete_row", {
        name: REMOVE_ROWS_NAME,
        sequence: 90,
        action: REMOVE_ROWS_ACTION,
    })
        .add("delete_column", {
        name: REMOVE_COLUMNS_NAME,
        sequence: 100,
        action: REMOVE_COLUMNS_ACTION,
        separator: true,
    })
        .add("clear_cell", {
        name: _lt("Clear cell"),
        sequence: 110,
        action: DELETE_CONTENT_ACTION,
        isEnabled: (env) => {
            const cell = env.getters.getActiveCell();
            return Boolean(cell && cell.content);
        },
    })
        .add("conditional_formatting", {
        name: _lt("Conditional formatting"),
        sequence: 120,
        action: OPEN_CF_SIDEPANEL_ACTION,
        separator: true,
    });

    const colMenuRegistry = new MenuItemRegistry();
    colMenuRegistry
        .add("cut", {
        name: _lt("Cut"),
        sequence: 10,
        action: CUT_ACTION,
    })
        .add("copy", {
        name: _lt("Copy"),
        sequence: 20,
        action: COPY_ACTION,
    })
        .add("paste", {
        name: _lt("Paste"),
        sequence: 30,
        action: PASTE_ACTION,
    })
        .add("paste_special", {
        name: _lt("Paste special"),
        sequence: 40,
        separator: true,
    })
        .addChild("paste_value_only", ["paste_special"], {
        name: _lt("Paste value only"),
        sequence: 10,
        action: PASTE_VALUE_ACTION,
    })
        .addChild("paste_format_only", ["paste_special"], {
        name: _lt("Paste format only"),
        sequence: 20,
        action: PASTE_FORMAT_ACTION,
    })
        .add("add_column_before", {
        name: COLUMN_INSERT_COLUMNS_BEFORE_NAME,
        sequence: 50,
        action: INSERT_COLUMNS_BEFORE_ACTION,
    })
        .add("add_column_after", {
        name: COLUMN_INSERT_COLUMNS_AFTER_NAME,
        sequence: 60,
        action: INSERT_COLUMNS_AFTER_ACTION,
    })
        .add("delete_column", {
        name: REMOVE_COLUMNS_NAME,
        sequence: 70,
        action: REMOVE_COLUMNS_ACTION,
    })
        .add("clear_column", {
        name: DELETE_CONTENT_COLUMNS_NAME,
        sequence: 80,
        action: DELETE_CONTENT_COLUMNS_ACTION,
        separator: true,
    })
        .add("conditional_formatting", {
        name: _lt("Conditional formatting"),
        sequence: 90,
        action: OPEN_CF_SIDEPANEL_ACTION,
    });

    const rowMenuRegistry = new MenuItemRegistry();
    rowMenuRegistry
        .add("cut", {
        name: _lt("Cut"),
        sequence: 10,
        action: CUT_ACTION,
    })
        .add("copy", {
        name: _lt("Copy"),
        sequence: 20,
        action: COPY_ACTION,
    })
        .add("paste", {
        name: _lt("Paste"),
        sequence: 30,
        action: PASTE_ACTION,
    })
        .add("paste_special", {
        name: _lt("Paste special"),
        sequence: 40,
        separator: true,
    })
        .addChild("paste_value_only", ["paste_special"], {
        name: _lt("Paste value only"),
        sequence: 10,
        action: PASTE_VALUE_ACTION,
    })
        .addChild("paste_format_only", ["paste_special"], {
        name: _lt("Paste format only"),
        sequence: 20,
        action: PASTE_FORMAT_ACTION,
    })
        .add("add_row_before", {
        name: ROW_INSERT_ROWS_BEFORE_NAME,
        sequence: 50,
        action: INSERT_ROWS_BEFORE_ACTION,
    })
        .add("add_row_after", {
        name: ROW_INSERT_ROWS_AFTER_NAME,
        sequence: 60,
        action: INSERT_ROWS_AFTER_ACTION,
    })
        .add("delete_row", {
        name: REMOVE_ROWS_NAME,
        sequence: 70,
        action: REMOVE_ROWS_ACTION,
    })
        .add("clear_row", {
        name: DELETE_CONTENT_ROWS_NAME,
        sequence: 80,
        action: DELETE_CONTENT_ROWS_ACTION,
        separator: true,
    })
        .add("conditional_formatting", {
        name: _lt("Conditional formatting"),
        sequence: 90,
        action: OPEN_CF_SIDEPANEL_ACTION,
    });

    const sheetMenuRegistry = new MenuItemRegistry();
    function getDuplicateSheetName(env, sheet) {
        let i = 1;
        const names = env.getters.getSheets().map((s) => s.name);
        const baseName = _lt("Copy of %s", sheet);
        let name = baseName.toString();
        while (names.includes(name)) {
            name = `${baseName} (${i})`;
            i++;
        }
        return name;
    }
    sheetMenuRegistry
        .add("delete", {
        name: _lt("Delete"),
        sequence: 10,
        isVisible: (env) => {
            return env.getters.getSheets().length > 1;
        },
        action: (env) => env.dispatch("DELETE_SHEET_CONFIRMATION", { sheet: env.getters.getActiveSheet() }),
    })
        .add("duplicate", {
        name: _lt("Duplicate"),
        sequence: 20,
        action: (env) => {
            const sheet = env.getters.getActiveSheet();
            const name = getDuplicateSheetName(env, env.getters.getSheets().find((s) => s.id === sheet).name);
            env.dispatch("DUPLICATE_SHEET", {
                sheet,
                id: uuidv4(),
                name,
            });
        },
    })
        .add("rename", {
        name: _lt("Rename"),
        sequence: 30,
        action: (env) => env.dispatch("RENAME_SHEET", {
            interactive: true,
            sheet: env.getters.getActiveSheet(),
        }),
    })
        .add("move_right", {
        name: _lt("Move right"),
        sequence: 40,
        isVisible: (env) => {
            const sheet = env.getters.getActiveSheet();
            const sheets = env.getters.getSheets();
            return sheets.findIndex((s) => s.id === sheet) !== sheets.length - 1;
        },
        action: (env) => env.dispatch("MOVE_SHEET", { sheet: env.getters.getActiveSheet(), direction: "right" }),
    })
        .add("move_left", {
        name: _lt("Move left"),
        sequence: 50,
        isVisible: (env) => {
            const sheet = env.getters.getActiveSheet();
            return env.getters.getSheets().findIndex((s) => s.id === sheet) !== 0;
        },
        action: (env) => env.dispatch("MOVE_SHEET", { sheet: env.getters.getActiveSheet(), direction: "left" }),
    });

    const fontSizes = [
        { pt: 7.5, px: 10 },
        { pt: 8, px: 11 },
        { pt: 9, px: 12 },
        { pt: 10, px: 13 },
        { pt: 10.5, px: 14 },
        { pt: 11, px: 15 },
        { pt: 12, px: 16 },
        { pt: 14, px: 18.7 },
        { pt: 15, px: 20 },
        { pt: 16, px: 21.3 },
        { pt: 18, px: 24 },
        { pt: 22, px: 29.3 },
        { pt: 24, px: 32 },
        { pt: 26, px: 34.7 },
        { pt: 36, px: 48 },
    ];
    const fontSizeMap = {};
    for (let font of fontSizes) {
        fontSizeMap[font.pt] = font.px;
    }

    const topbarMenuRegistry = new MenuItemRegistry();
    topbarMenuRegistry
        .add("file", { name: _lt("File"), sequence: 10 })
        .add("edit", { name: _lt("Edit"), sequence: 20 })
        .add("view", { name: _lt("View"), sequence: 30 })
        .add("insert", { name: _lt("Insert"), sequence: 40 })
        .add("format", { name: _lt("Format"), sequence: 50 })
        .add("data", { name: _lt("Data"), sequence: 60 })
        .addChild("save", ["file"], {
        name: _lt("Save"),
        sequence: 10,
        action: () => console.log("Not implemented"),
    })
        .addChild("undo", ["edit"], {
        name: _lt("Undo"),
        sequence: 10,
        action: UNDO_ACTION,
    })
        .addChild("redo", ["edit"], {
        name: _lt("Redo"),
        sequence: 20,
        action: REDO_ACTION,
        separator: true,
    })
        .addChild("copy", ["edit"], {
        name: _lt("Copy"),
        sequence: 30,
        action: COPY_ACTION,
    })
        .addChild("cut", ["edit"], {
        name: _lt("Cut"),
        sequence: 40,
        action: CUT_ACTION,
    })
        .addChild("paste", ["edit"], {
        name: _lt("Paste"),
        sequence: 50,
        action: PASTE_ACTION,
    })
        .addChild("paste_special", ["edit"], {
        name: _lt("Paste special"),
        sequence: 60,
        separator: true,
    })
        .addChild("paste_special_value", ["edit", "paste_special"], {
        name: _lt("Paste value only"),
        sequence: 10,
        action: PASTE_VALUE_ACTION,
    })
        .addChild("paste_special_format", ["edit", "paste_special"], {
        name: _lt("Paste format only"),
        sequence: 20,
        action: PASTE_FORMAT_ACTION,
    })
        .addChild("edit_delete_cell_values", ["edit"], {
        name: _lt("Delete values"),
        sequence: 70,
        action: DELETE_CONTENT_ACTION,
    })
        .addChild("edit_delete_row", ["edit"], {
        name: REMOVE_ROWS_NAME,
        sequence: 80,
        action: REMOVE_ROWS_ACTION,
    })
        .addChild("edit_delete_column", ["edit"], {
        name: REMOVE_COLUMNS_NAME,
        sequence: 90,
        action: REMOVE_COLUMNS_ACTION,
    })
        .addChild("insert_row_before", ["insert"], {
        name: MENU_INSERT_ROWS_BEFORE_NAME,
        sequence: 10,
        action: INSERT_ROWS_BEFORE_ACTION,
        isVisible: (env) => env.getters.getActiveCols().size === 0,
    })
        .addChild("insert_row_after", ["insert"], {
        name: MENU_INSERT_ROWS_AFTER_NAME,
        sequence: 20,
        action: INSERT_ROWS_AFTER_ACTION,
        isVisible: (env) => env.getters.getActiveCols().size === 0,
        separator: true,
    })
        .addChild("insert_column_before", ["insert"], {
        name: MENU_INSERT_COLUMNS_BEFORE_NAME,
        sequence: 30,
        action: INSERT_COLUMNS_BEFORE_ACTION,
        isVisible: (env) => env.getters.getActiveRows().size === 0,
    })
        .addChild("insert_column_after", ["insert"], {
        name: MENU_INSERT_COLUMNS_AFTER_NAME,
        sequence: 40,
        action: INSERT_COLUMNS_AFTER_ACTION,
        isVisible: (env) => env.getters.getActiveRows().size === 0,
        separator: true,
    })
        .addChild("insert_chart", ["insert"], {
        name: _lt("Chart"),
        sequence: 50,
        action: CREATE_CHART,
        separator: true,
    })
        .addChild("insert_sheet", ["insert"], {
        name: _lt("New sheet"),
        sequence: 60,
        action: CREATE_SHEET_ACTION,
        separator: true,
    })
        .addChild("view_formulas", ["view"], {
        name: (env) => env.getters.shouldShowFormulas() ? _lt("Hide formulas") : _lt("Show formulas"),
        action: SET_FORMULA_VISIBILITY_ACTION,
        sequence: 10,
    })
        .addChild("format_number", ["format"], {
        name: _lt("Numbers"),
        sequence: 10,
        separator: true,
    })
        .addChild("format_number_auto", ["format", "format_number"], {
        name: _lt("Automatic"),
        sequence: 10,
        separator: true,
        action: FORMAT_AUTO_ACTION,
    })
        .addChild("format_number_number", ["format", "format_number"], {
        name: _lt("Number (1,000.12)"),
        sequence: 20,
        action: FORMAT_NUMBER_ACTION,
    })
        .addChild("format_number_percent", ["format", "format_number"], {
        name: _lt("Percent (10.12%)"),
        sequence: 30,
        separator: true,
        action: FORMAT_PERCENT_ACTION,
    })
        .addChild("format_number_date", ["format", "format_number"], {
        name: _lt("Date (9/26/2008)"),
        sequence: 40,
        action: FORMAT_DATE_ACTION,
    })
        .addChild("format_number_time", ["format", "format_number"], {
        name: _lt("Time (10:43:00 PM)"),
        sequence: 50,
        action: FORMAT_TIME_ACTION,
    })
        .addChild("format_number_date_time", ["format", "format_number"], {
        name: _lt("Date time (9/26/2008 22:43:00)"),
        sequence: 60,
        action: FORMAT_DATE_TIME_ACTION,
    })
        .addChild("format_number_duration", ["format", "format_number"], {
        name: _lt("Duration (27:51:38)"),
        sequence: 70,
        separator: true,
        action: FORMAT_DURATION_ACTION,
    })
        .addChild("format_bold", ["format"], {
        name: _lt("Bold"),
        sequence: 20,
        action: FORMAT_BOLD_ACTION,
    })
        .addChild("format_italic", ["format"], {
        name: _lt("Italic"),
        sequence: 30,
        action: FORMAT_ITALIC_ACTION,
    })
        // .addChild("format_underline", ["format"], {
        //   Underline is not yet implemented
        //   name: _lt("Underline"),
        //   sequence: 40,
        // })
        .addChild("format_strikethrough", ["format"], {
        name: _lt("Strikethrough"),
        sequence: 50,
        action: FORMAT_STRIKETHROUGH_ACTION,
        separator: true,
    })
        .addChild("format_font_size", ["format"], {
        name: _lt("Font size"),
        sequence: 60,
        separator: true,
    })
        .addChild("format_cf", ["format"], {
        name: _lt("Conditional formatting"),
        sequence: 70,
        action: OPEN_CF_SIDEPANEL_ACTION,
        separator: true,
    });
    // Font-sizes
    for (let fs of fontSizes) {
        topbarMenuRegistry.addChild(`format_font_size_${fs.pt}`, ["format", "format_font_size"], {
            name: fs.pt.toString(),
            sequence: fs.pt,
            action: (env) => setStyle(env, { fontSize: fs.pt }),
        });
    }

    const Component$e = owl__namespace.Component;
    const { xml: xml$g, css: css$g } = owl__namespace.tags;
    const TEMPLATE$d = xml$g /* xml */ `
  <div class="o-selection">
    <t t-foreach="ranges" t-as="range" t-key="range.id">
      <input
        type="text"
        spellcheck="false"
        t-on-change="onInputChanged(range.id)"
        t-on-focus="focus(range.id)"
        t-att-value="range.xc"
        t-attf-style="color: {{range.color || '#000'}}"
        t-att-class="range.isFocused ? 'o-focused' : ''"
      />
      <button
        class="o-remove-selection"
        t-if="ranges.length > 1"
        t-on-click="removeInput(range.id)">✖</button>
    </t>

    <div class="o-selection-controls">
      <button
        t-if="canAddRange"
        t-on-click="addEmptyInput"
        class="o-btn o-add-selection">Add another range</button>
      <button
        class="o-btn o-selection-ok"
        t-if="hasFocus"
        t-on-click="disable">OK</button>
    </div>
  </div>`;
    const CSS$d = css$g /* scss */ `
  .o-selection {
    input {
      display: inline-block;
      padding: 4px 6px;
      border-radius: 4px;
      box-sizing: border-box;
      border: 1px solid #dadce0;
      width: 100%;
    }
    input:focus {
      outline: none;
    }
    input.o-focused {
      border-color: #3266ca;
      border-width: 2px;
      padding: 3px 5px;
    }
    button.o-remove-selection {
      margin-left: -30px;
      background: transparent;
      border: none;
      color: #333;
      cursor: pointer;
    }
    button.o-btn {
      margin: 8px 1px;
      border-radius: 4px;
      background: transparent;
      border: 1px solid #dadce0;
      color: #188038;
      font-weight: bold;
      font-size: 14px;
      height: 25px;
    }
  }
`;
    /**
     * This component can be used when the user needs to input some
     * ranges. He can either input the ranges with the regular DOM `<input/>`
     * displayed or by selecting zones on the grid.
     *
     * A `selection-changed` event is triggered every time the input value
     * changes.
     */
    class SelectionInput extends Component$e {
        constructor() {
            super(...arguments);
            this.id = uuidv4();
            this.previousRanges = this.props.ranges || [];
            this.getters = this.env.getters;
            this.dispatch = this.env.dispatch;
        }
        get ranges() {
            return this.getters.getSelectionInput(this.id);
        }
        get hasFocus() {
            return this.ranges.filter((i) => i.isFocused).length > 0;
        }
        get canAddRange() {
            return !this.props.maximumRanges || this.ranges.length < this.props.maximumRanges;
        }
        mounted() {
            this.dispatch("ENABLE_NEW_SELECTION_INPUT", {
                id: this.id,
                initialRanges: this.props.ranges,
                maximumRanges: this.props.maximumRanges,
            });
        }
        async willUnmount() {
            this.dispatch("DISABLE_SELECTION_INPUT", { id: this.id });
        }
        async patched() {
            const value = this.getters.getSelectionInputValue(this.id);
            if (this.previousRanges.join() !== value.join()) {
                this.triggerChange();
            }
        }
        triggerChange() {
            const ranges = this.getters.getSelectionInputValue(this.id);
            this.trigger("selection-changed", { ranges });
            this.previousRanges = ranges;
        }
        focus(rangeId) {
            this.dispatch("FOCUS_RANGE", {
                id: this.id,
                rangeId,
            });
        }
        addEmptyInput() {
            this.dispatch("ADD_EMPTY_RANGE", { id: this.id });
        }
        removeInput(rangeId) {
            this.dispatch("REMOVE_RANGE", { id: this.id, rangeId });
            this.triggerChange();
        }
        onInputChanged(rangeId, ev) {
            const target = ev.target;
            this.dispatch("CHANGE_RANGE", {
                id: this.id,
                rangeId,
                value: target.value,
            });
            target.blur();
            this.triggerChange();
        }
        disable() {
            this.dispatch("FOCUS_RANGE", {
                id: this.id,
                rangeId: null,
            });
        }
    }
    SelectionInput.template = TEMPLATE$d;
    SelectionInput.style = CSS$d;

    const terms = {
        CF_TITLE: _lt("Format rules"),
        IS_RULE: _lt("Format cells if..."),
        FORMATTING_STYLE: _lt("Formatting style"),
        BOLD: _lt("Bold"),
        ITALIC: _lt("Italic"),
        STRIKETHROUGH: _lt("Strikethrough"),
        TEXTCOLOR: _lt("Text Color"),
        FILLCOLOR: _lt("Fill Color"),
        CANCEL: _lt("Cancel"),
        SAVE: _lt("Save"),
        PREVIEWTEXT: _lt("Preview text"),
    };
    const cellIsOperators = {
        BeginsWith: _lt("Begins with"),
        Between: _lt("Between"),
        ContainsText: _lt("Contains text"),
        EndsWith: _lt("Ends with"),
        Equal: _lt("Is equal to"),
        GreaterThan: _lt("Greater than"),
        GreaterThanOrEqual: _lt("Greater than or equal"),
        LessThan: _lt("Less than"),
        LessThanOrEqual: _lt("Less than or equal"),
        NotBetween: _lt("Not between"),
        NotContains: _lt("Not contains"),
        NotEqual: _lt("Not equal"),
    };
    const chartTerms = {
        ChartType: _lt("Chart type"),
        Line: _lt("Line"),
        Bar: _lt("Bar"),
        Pie: _lt("Pie"),
        Title: _lt("Title"),
        Series: _lt("Series"),
        DataSeries: _lt("Data Series"),
        MyDataHasTitle: _lt("My data has title"),
        DataCategories: _lt("Data categories (labels)"),
        UpdateChart: _lt("Update chart"),
        CreateChart: _lt("Create chart"),
        TitlePlaceholder: _lt("New Chart"),
    };

    const Component$d = owl__namespace.Component;
    const { useState: useState$d } = owl__namespace;
    const { xml: xml$f, css: css$f } = owl__namespace.tags;
    const TEMPLATE$c = xml$f /* xml */ `
  <div class="o-chart">
    <div class="o-section">
      <div class="o-section-title"><t t-esc="env._t('${chartTerms.ChartType}')"/></div>
      <select t-model="state.type" class="o-input o-type-selector">
        <option value="bar" t-esc="env._t('${chartTerms.Bar}')"/>
        <option value="line" t-esc="env._t('${chartTerms.Line}')"/>
        <option value="pie" t-esc="env._t('${chartTerms.Pie}')"/>
      </select>
    </div>
    <div class="o-section o-chart-title">
      <div class="o-section-title" t-esc="env._t('${chartTerms.Title}')"/>
      <input type="text" t-model="state.title" class="o-input" t-att-placeholder="env._t('${chartTerms.TitlePlaceholder}')"/>
    </div>
    <div class="o-section o-data-series">
      <div class="o-section-title" t-esc="env._t('${chartTerms.DataSeries}')"/>
      <SelectionInput ranges="state.ranges" t-on-selection-changed="onSeriesChanged"/>
      <input type="checkbox" t-model="state.seriesHasTitle"/><t t-esc="env._t('${chartTerms.MyDataHasTitle}')"/>
    </div>
    <div class="o-section o-data-labels">
        <div class="o-section-title" t-esc="env._t('${chartTerms.DataCategories}')"/>
        <SelectionInput ranges="[state.labelRange]" t-on-selection-changed="onLabelRangeChanged" maximumRanges="1"/>
    </div>
    <div class="o-sidePanelButtons">
      <button t-if="props.figure" t-on-click="updateChart(props.figure)" class="o-sidePanelButton" t-esc="env._t('${chartTerms.UpdateChart}')"/>
      <button t-else="" t-on-click="createChart" t-att-class="{ 'o-error': state.errorWhileCreating }" class="o-sidePanelButton" t-esc="env._t('${chartTerms.CreateChart}')"/>
    </div>
  </div>
`;
    const CSS$c = css$f /*scss */ `
  .o-chart {
    .o-sidePanelButton.o-error {
      border-color: #e14747;
    }
  }
`;
    class ChartPanel extends Component$d {
        constructor() {
            super(...arguments);
            this.getters = this.env.getters;
            this.state = useState$d(this.initialState());
        }
        onSeriesChanged(ev) {
            this.state.ranges = ev.detail.ranges;
        }
        onLabelRangeChanged(ev) {
            this.state.labelRange = ev.detail.ranges[0];
        }
        createChart() {
            const result = this.env.dispatch("CREATE_CHART", {
                sheetId: this.getters.getActiveSheet(),
                id: uuidv4(),
                definition: this.getChartDefinition(),
            });
            if (result.status === "SUCCESS") {
                this.trigger("close-side-panel");
            }
            else {
                this.state.errorWhileCreating = true;
            }
        }
        updateChart(chart) {
            this.env.dispatch("UPDATE_CHART", {
                id: chart.id,
                definition: this.getChartDefinition(),
            });
            this.trigger("close-side-panel");
        }
        getChartDefinition() {
            return {
                type: this.state.type,
                title: this.state.title,
                labelRange: this.state.labelRange.trim() || "",
                dataSets: this.state.ranges.slice(),
                seriesHasTitle: this.state.seriesHasTitle,
            };
        }
        initialState() {
            const data = this.props.figure ? this.props.figure.data : undefined;
            return {
                title: data && data.title ? data.title : "",
                ranges: data ? data.dataSets.map((ds) => ds.dataRange) : [],
                labelRange: data ? data.labelRange : "",
                type: data ? data.type : "bar",
                seriesHasTitle: data ? data.title !== undefined : false,
                errorWhileCreating: false,
            };
        }
    }
    ChartPanel.template = TEMPLATE$c;
    ChartPanel.style = CSS$c;
    ChartPanel.components = { SelectionInput };

    const Component$c = owl__namespace.Component;
    const { css: css$e, xml: xml$e } = owl__namespace.tags;
    const COLORS = [
        [
            "#000000",
            "#434343",
            "#666666",
            "#999999",
            "#b7b7b7",
            "#cccccc",
            "#d9d9d9",
            "#efefef",
            "#f3f3f3",
            "#ffffff",
        ],
        [
            "#980000",
            "#ff0000",
            "#ff9900",
            "#ffff00",
            "#00ff00",
            "#00ffff",
            "#4a86e8",
            "#0000ff",
            "#9900ff",
            "#ff00ff",
        ],
        [
            "#e6b8af",
            "#f4cccc",
            "#fce5cd",
            "#fff2cc",
            "#d9ead3",
            "#d0e0e3",
            "#c9daf8",
            "#cfe2f3",
            "#d9d2e9",
            "#ead1dc",
        ],
        [
            "#dd7e6b",
            "#ea9999",
            "#f9cb9c",
            "#ffe599",
            "#b6d7a8",
            "#a2c4c9",
            "#a4c2f4",
            "#9fc5e8",
            "#b4a7d6",
            "#d5a6bd",
        ],
        [
            "#cc4125",
            "#e06666",
            "#f6b26b",
            "#ffd966",
            "#93c47d",
            "#76a5af",
            "#6d9eeb",
            "#6fa8dc",
            "#8e7cc3",
            "#c27ba0",
        ],
        [
            "#a61c00",
            "#cc0000",
            "#e69138",
            "#f1c232",
            "#6aa84f",
            "#45818e",
            "#3c78d8",
            "#3d85c6",
            "#674ea7",
            "#a64d79",
        ],
        [
            "#85200c",
            "#990000",
            "#b45f06",
            "#bf9000",
            "#38761d",
            "#134f5c",
            "#1155cc",
            "#0b5394",
            "#351c75",
            "#741b47",
        ],
        [
            "#5b0f00",
            "#660000",
            "#783f04",
            "#7f6000",
            "#274e13",
            "#0c343d",
            "#1c4587",
            "#073763",
            "#20124d",
            "#4c1130",
        ],
    ];
    class ColorPicker extends Component$c {
        constructor() {
            super(...arguments);
            this.COLORS = COLORS;
        }
        onColorClick(ev) {
            const color = ev.target.dataset.color;
            if (color) {
                this.trigger("color-picked", { color });
            }
        }
    }
    ColorPicker.template = xml$e /* xml */ `
  <div class="o-color-picker" t-on-click="onColorClick">
    <div class="o-color-picker-line" t-foreach="COLORS" t-as="colors" t-key="colors">
      <t t-foreach="colors" t-as="color" t-key="color">
        <div class="o-color-picker-line-item" t-att-data-color="color" t-attf-style="background-color:{{color}};"></div>
      </t>
    </div>
  </div>`;
    ColorPicker.style = css$e /* scss */ `
    .o-color-picker {
      position: absolute;
      top: calc(100% + 5px);
      left: 0;
      z-index: 10;
      box-shadow: 1px 2px 5px 2px rgba(51, 51, 51, 0.15);
      background-color: white;
      padding: 6px 0px;

      .o-color-picker-line {
        display: flex;
        padding: 3px 6px;
        .o-color-picker-line-item {
          width: 18px;
          height: 18px;
          margin: 0px 2px;
          border-radius: 50px;
          border: 1px solid #c0c0c0;
          &:hover {
            background-color: rgba(0, 0, 0, 0.08);
            outline: 1px solid gray;
          }
        }
      }
    }
  `;

    // -----------------------------------------------------------------------------
    // Icons
    // -----------------------------------------------------------------------------
    const UNDO_ICON = `<svg class="o-icon"><path fill="#000000" d="M11.5656391,4.43436088 L9,7 L16,7 L16,0 L13.0418424,2.95815758 C11.5936787,1.73635959 9.72260775,1 7.67955083,1 C4.22126258,1 1.25575599,3.10984908 0,6 L2,7 C2.93658775,4.60974406 5.12943697,3.08011229 7.67955083,3 C9.14881247,3.0528747 10.4994783,3.57862053 11.5656391,4.43436088 Z" transform="matrix(-1 0 0 1 17 5)"/></svg>`;
    const REDO_ICON = `<svg class="o-icon"><path fill="#000000" d="M11.5656391,4.43436088 L9,7 L16,7 L16,0 L13.0418424,2.95815758 C11.5936787,1.73635959 9.72260775,1 7.67955083,1 C4.22126258,1 1.25575599,3.10984908 0,6 L2,7 C2.93658775,4.60974406 5.12943697,3.08011229 7.67955083,3 C9.14881247,3.0528747 10.4994783,3.57862053 11.5656391,4.43436088 Z" transform="translate(1 5)"/></svg>`;
    const PAINT_FORMAT_ICON = `<svg class="o-icon"><path fill="#000000" d="M9,0 L1,0 C0.45,0 0,0.45 0,1 L0,4 C0,4.55 0.45,5 1,5 L9,5 C9.55,5 10,4.55 10,4 L10,3 L11,3 L11,6 L4,6 L4,14 L6,14 L6,8 L13,8 L13,2 L10,2 L10,1 C10,0.45 9.55,0 9,0 Z" transform="translate(3 2)"/></svg>`;
    const CLEAR_FORMAT_ICON = `<svg class="o-icon"><path fill="#000000" d="M0.27,1.55 L5.43,6.7 L3,12 L5.5,12 L7.14,8.42 L11.73,13 L13,11.73 L1.55,0.27 L0.27,1.55 L0.27,1.55 Z M3.82,0 L5.82,2 L7.58,2 L7.03,3.21 L8.74,4.92 L10.08,2 L14,2 L14,0 L3.82,0 L3.82,0 Z" transform="translate(2 3)"/></svg>`;
    const TRIANGLE_DOWN_ICON = `<svg class="o-icon"><polygon fill="#000000" points="0 0 4 4 8 0" transform="translate(5 7)"/></svg>`;
    const TRIANGLE_RIGHT_ICON = `<svg class="o-icon"><polygon fill="#000000" points="0 0 4 4 0 8" transform="translate(5 5)"/></svg>`;
    const BOLD_ICON = `<svg class="o-icon"><path fill="#000000" fill-rule="evenodd" d="M9,3.5 C9,1.57 7.43,0 5.5,0 L1.77635684e-15,0 L1.77635684e-15,12 L6.25,12 C8.04,12 9.5,10.54 9.5,8.75 C9.5,7.45 8.73,6.34 7.63,5.82 C8.46,5.24 9,4.38 9,3.5 Z M5,2 C5.82999992,2 6.5,2.67 6.5,3.5 C6.5,4.33 5.82999992,5 5,5 L3,5 L3,2 L5,2 Z M3,10 L3,7 L5.5,7 C6.32999992,7 7,7.67 7,8.5 C7,9.33 6.32999992,10 5.5,10 L3,10 Z" transform="translate(4 3)"/></svg>`;
    const ITALIC_ICON = `<svg class="o-icon"><polygon fill="#000000" fill-rule="evenodd" points="4 0 4 2 6.58 2 2.92 10 0 10 0 12 8 12 8 10 5.42 10 9.08 2 12 2 12 0" transform="translate(3 3)"/></svg>`;
    const STRIKE_ICON = `<svg class="o-icon"><path fill="#010101" fill-rule="evenodd" d="M2.8875,3.06 C2.8875,2.6025 2.985,2.18625 3.18375,1.8075 C3.3825,1.42875 3.66,1.10625 4.02,0.84 C4.38,0.57375 4.80375,0.3675 5.29875,0.22125 C5.79375,0.075 6.33375,0 6.92625,0 C7.53375,0 8.085,0.0825 8.58,0.25125 C9.075,0.42 9.49875,0.6525 9.85125,0.95625 C10.20375,1.25625 10.47375,1.6125 10.665,2.02875 C10.85625,2.44125 10.95,2.895 10.95,3.38625 L8.6925,3.38625 C8.6925,3.1575 8.655,2.94375 8.58375,2.74875 C8.5125,2.55 8.4,2.38125 8.25,2.2425 C8.1,2.10375 7.9125,1.99125 7.6875,1.91625 C7.4625,1.8375 7.19625,1.8 6.88875,1.8 C6.5925,1.8 6.3375,1.83375 6.11625,1.8975 C5.89875,1.96125 5.71875,2.05125 5.57625,2.1675 C5.43375,2.28375 5.325,2.41875 5.25375,2.5725 C5.1825,2.72625 5.145,2.895 5.145,3.0675 C5.145,3.4275 5.32875,3.73125 5.69625,3.975 C5.71780203,3.98908066 5.73942012,4.00311728 5.76118357,4.01733315 C6.02342923,4.18863185 6.5,4.5 7,5 L4,5 C4,5 3.21375,4.37625 3.17625,4.30875 C2.985,3.9525 2.8875,3.53625 2.8875,3.06 Z M14,6 L0,6 L0,8 L7.21875,8 C7.35375,8.0525 7.51875,8.105 7.63125,8.15375 C7.90875,8.2775 8.12625,8.40875 8.28375,8.53625 C8.44125,8.6675 8.54625,8.81 8.6025,8.96 C8.65875,9.11375 8.685,9.28625 8.685,9.47375 C8.685,9.65 8.65125,9.815 8.58375,9.965 C8.51625,10.11875 8.41125,10.25 8.2725,10.35875 C8.13375,10.4675 7.95375,10.55375 7.74,10.6175 C7.5225,10.68125 7.27125,10.71125 6.97875,10.71125 C6.6525,10.71125 6.35625,10.6775 6.09,10.61375 C5.82375,10.55 5.59875,10.445 5.41125,10.3025 C5.22375,10.16 5.0775,9.9725 4.9725,9.74375 C4.8675,9.515 4.78125,9.17 4.78125,9 L2.55,9 C2.55,9.2525 2.61,9.6875 2.72625,10.025 C2.8425,10.3625 3.0075,10.66625 3.21375,10.9325 C3.42,11.19875 3.6675,11.4275 3.94875,11.6225 C4.23,11.8175 4.53375,11.9825 4.86375,12.11 C5.19375,12.24125 5.535,12.33875 5.89875,12.39875 C6.25875,12.4625 6.6225,12.4925 6.9825,12.4925 C7.5825,12.4925 8.13,12.425 8.6175,12.28625 C9.105,12.1475 9.525,11.94875 9.87,11.69375 C10.215,11.435 10.48125,11.12 10.6725,10.74125 C10.86375,10.3625 10.95375,9.935 10.95375,9.455 C10.95375,9.005 10.875,8.6 10.72125,8.24375 C10.68375,8.1575 10.6425,8.075 10.59375,7.9925 L14,8 L14,6 Z" transform="translate(2 3)"/></svg>`;
    const TEXT_COLOR_ICON = `<svg class="o-icon"><path fill="#000000" d="M7,0 L5,0 L0.5,12 L2.5,12 L3.62,9 L8.37,9 L9.49,12 L11.49,12 L7,0 L7,0 Z M4.38,7 L6,2.67 L7.62,7 L4.38,7 L4.38,7 Z" transform="translate(3 1)"/></svg>`;
    const FILL_COLOR_ICON = `<svg class="o-icon"><path fill="#000000" d="M14.5,8.87 C14.5,8.87 13,10.49 13,11.49 C13,12.32 13.67,12.99 14.5,12.99 C15.33,12.99 16,12.32 16,11.49 C16,10.5 14.5,8.87 14.5,8.87 L14.5,8.87 Z M12.71,6.79 L5.91,0 L4.85,1.06 L6.44,2.65 L2.29,6.79 C1.9,7.18 1.9,7.81 2.29,8.2 L6.79,12.7 C6.99,12.9 7.24,13 7.5,13 C7.76,13 8.01,12.9 8.21,12.71 L12.71,8.21 C13.1,7.82 13.1,7.18 12.71,6.79 L12.71,6.79 Z M4.21,7 L7.5,3.71 L10.79,7 L4.21,7 L4.21,7 Z"/></svg>`;
    const MERGE_CELL_ICON = `<svg class="o-icon"><path fill="#000000" d="M3,6 L1,6 L1,2 L8,2 L8,4 L3,4 L3,6 Z M10,4 L10,2 L17,2 L17,6 L15,6 L15,4 L10,4 Z M10,14 L15,14 L15,12 L17,12 L17,16 L10,16 L10,14 Z M1,12 L3,12 L3,14 L8,14 L8,16 L1,16 L1,12 Z M1,8 L5,8 L5,6 L8,9 L5,12 L5,10 L1,10 L1,8 Z M10,9 L13,6 L13,8 L17,8 L17,10 L13,10 L13,12 L10,9 Z"/></svg>`;
    const ALIGN_LEFT_ICON = `<svg class="o-icon"><path fill="#000000" d="M0,14 L10,14 L10,12 L0,12 L0,14 Z M10,4 L0,4 L0,6 L10,6 L10,4 Z M0,0 L0,2 L14,2 L14,0 L0,0 Z M0,10 L14,10 L14,8 L0,8 L0,10 Z" transform="translate(2 2)"/></svg>`;
    const ALIGN_CENTER_ICON = `<svg class="o-icon"><path fill="#000000" d="M2,12 L2,14 L12,14 L12,12 L2,12 Z M2,4 L2,6 L12,6 L12,4 L2,4 Z M0,10 L14,10 L14,8 L0,8 L0,10 Z M0,0 L0,2 L14,2 L14,0 L0,0 Z" transform="translate(2 2)"/></svg>`;
    const ALIGN_RIGHT_ICON = `<svg class="o-icon"><path fill="#000000" d="M4,14 L14,14 L14,12 L4,12 L4,14 Z M0,10 L14,10 L14,8 L0,8 L0,10 Z M0,0 L0,2 L14,2 L14,0 L0,0 Z M4,6 L14,6 L14,4 L4,4 L4,6 Z" transform="translate(2 2)"/></svg>`;
    // export const ALIGN_TOP_ICON = `<svg class="o-icon"><path fill="#000000" d="M0,0 L0,2 L12,2 L12,0 L0,0 L0,0 Z M2.5,7 L5,7 L5,14 L7,14 L7,7 L9.5,7 L6,3.5 L2.5,7 L2.5,7 Z" transform="translate(3 2)"/></svg>`;
    const ALIGN_MIDDLE_ICON = `<svg class="o-icon"><path fill="#000000" d="M9.5,3 L7,3 L7,0 L5,0 L5,3 L2.5,3 L6,6.5 L9.5,3 L9.5,3 Z M0,8 L0,10 L12,10 L12,8 L0,8 L0,8 Z M2.5,15 L5,15 L5,18 L7,18 L7,15 L9.5,15 L6,11.5 L2.5,15 L2.5,15 Z" transform="translate(3)"/></svg>`;
    // export const ALIGN_BOTTOM_ICON = `<svg class="o-icon"><path fill="#000000" d="M9.5,7 L7,7 L7,0 L5,0 L5,7 L2.5,7 L6,10.5 L9.5,7 L9.5,7 Z M0,12 L0,14 L12,14 L12,12 L0,12 L0,12 Z" transform="translate(3 2)"/></svg>`;
    const TEXT_WRAPPING_ICON = `<svg class="o-icon"><path fill="#000000" d="M14,0 L0,0 L0,2 L14,2 L14,0 Z M0,12 L4,12 L4,10 L0,10 L0,12 Z M11.5,5 L0,5 L0,7 L11.75,7 C12.58,7 13.25,7.67 13.25,8.5 C13.25,9.33 12.58,10 11.75,10 L9,10 L9,8 L6,11 L9,14 L9,12 L11.5,12 C13.43,12 15,10.43 15,8.5 C15,6.57 13.43,5 11.5,5 Z" transform="translate(2 3)"/></svg>`;
    const BORDERS_ICON = `<svg class="o-icon"><path fill="#000000" d="M0,0 L0,14 L14,14 L14,0 L0,0 L0,0 Z M6,12 L2,12 L2,8 L6,8 L6,12 L6,12 Z M6,6 L2,6 L2,2 L6,2 L6,6 L6,6 Z M12,12 L8,12 L8,8 L12,8 L12,12 L12,12 Z M12,6 L8,6 L8,2 L12,2 L12,6 L12,6 Z" transform="translate(2 2)"/></svg>`;
    const BORDER_HV = `<svg class="o-icon"><g fill="#000000"><path d="M0,14 L2,14 L2,12 L0,12 L0,14 L0,14 Z M2,3 L0,3 L0,5 L2,5 L2,3 L2,3 Z M3,14 L5,14 L5,12 L3,12 L3,14 L3,14 Z M11,0 L9,0 L9,2 L11,2 L11,0 L11,0 Z M2,0 L0,0 L0,2 L2,2 L2,0 L2,0 Z M5,0 L3,0 L3,2 L5,2 L5,0 L5,0 Z M0,11 L2,11 L2,9 L0,9 L0,11 L0,11 Z M9,14 L11,14 L11,12 L9,12 L9,14 L9,14 Z M12,0 L12,2 L14,2 L14,0 L12,0 L12,0 Z M12,5 L14,5 L14,3 L12,3 L12,5 L12,5 Z M12,14 L14,14 L14,12 L12,12 L12,14 L12,14 Z M12,11 L14,11 L14,9 L12,9 L12,11 L12,11 Z" opacity=".54"/><polygon points="8 0 6 0 6 6 0 6 0 8 6 8 6 14 8 14 8 8 14 8 14 6 8 6"/></g></svg>`;
    const BORDER_H = `<svg class="o-icon"><g fill="#000000"><path d="M6,14 L8,14 L8,12 L6,12 L6,14 L6,14 Z M3,2 L5,2 L5,0 L3,0 L3,2 L3,2 Z M6,11 L8,11 L8,9 L6,9 L6,11 L6,11 Z M3,14 L5,14 L5,12 L3,12 L3,14 L3,14 Z M0,5 L2,5 L2,3 L0,3 L0,5 L0,5 Z M0,14 L2,14 L2,12 L0,12 L0,14 L0,14 Z M0,2 L2,2 L2,0 L0,0 L0,2 L0,2 Z M0,11 L2,11 L2,9 L0,9 L0,11 L0,11 Z M12,11 L14,11 L14,9 L12,9 L12,11 L12,11 Z M12,14 L14,14 L14,12 L12,12 L12,14 L12,14 Z M12,5 L14,5 L14,3 L12,3 L12,5 L12,5 Z M12,0 L12,2 L14,2 L14,0 L12,0 L12,0 Z M6,2 L8,2 L8,0 L6,0 L6,2 L6,2 Z M9,2 L11,2 L11,0 L9,0 L9,2 L9,2 Z M6,5 L8,5 L8,3 L6,3 L6,5 L6,5 Z M9,14 L11,14 L11,12 L9,12 L9,14 L9,14 Z" opacity=".54"/><polygon points="0 8 14 8 14 6 0 6"/></g></svg>`;
    const BORDER_V = `<svg class="o-icon"><g fill="#000000"><path d="M3,14 L5,14 L5,12 L3,12 L3,14 L3,14 Z M0,5 L2,5 L2,3 L0,3 L0,5 L0,5 Z M0,2 L2,2 L2,0 L0,0 L0,2 L0,2 Z M3,8 L5,8 L5,6 L3,6 L3,8 L3,8 Z M3,2 L5,2 L5,0 L3,0 L3,2 L3,2 Z M0,14 L2,14 L2,12 L0,12 L0,14 L0,14 Z M0,8 L2,8 L2,6 L0,6 L0,8 L0,8 Z M0,11 L2,11 L2,9 L0,9 L0,11 L0,11 Z M12,0 L12,2 L14,2 L14,0 L12,0 L12,0 Z M12,8 L14,8 L14,6 L12,6 L12,8 L12,8 Z M12,14 L14,14 L14,12 L12,12 L12,14 L12,14 Z M12,5 L14,5 L14,3 L12,3 L12,5 L12,5 Z M12,11 L14,11 L14,9 L12,9 L12,11 L12,11 Z M9,14 L11,14 L11,12 L9,12 L9,14 L9,14 Z M9,8 L11,8 L11,6 L9,6 L9,8 L9,8 Z M9,2 L11,2 L11,0 L9,0 L9,2 L9,2 Z" opacity=".54"/><polygon points="6 14 8 14 8 0 6 0"/></g></svg>`;
    const BORDER_EXTERNAL = `<svg class="o-icon"><g fill="#000000"><path d="M8,3 L6,3 L6,5 L8,5 L8,3 L8,3 Z M11,6 L9,6 L9,8 L11,8 L11,6 L11,6 Z M8,6 L6,6 L6,8 L8,8 L8,6 L8,6 Z M8,9 L6,9 L6,11 L8,11 L8,9 L8,9 Z M5,6 L3,6 L3,8 L5,8 L5,6 L5,6 Z" opacity=".54"/><path d="M0,0 L14,0 L14,14 L0,14 L0,0 Z M12,12 L12,2 L2,2 L2,12 L12,12 Z"/></g></svg>`;
    const BORDER_LEFT = `<svg class="o-icon"><g fill="#000000"><path d="M6,8 L8,8 L8,6 L6,6 L6,8 L6,8 Z M6,5 L8,5 L8,3 L6,3 L6,5 L6,5 Z M6,11 L8,11 L8,9 L6,9 L6,11 L6,11 Z M6,14 L8,14 L8,12 L6,12 L6,14 L6,14 Z M3,14 L5,14 L5,12 L3,12 L3,14 L3,14 Z M3,2 L5,2 L5,0 L3,0 L3,2 L3,2 Z M3,8 L5,8 L5,6 L3,6 L3,8 L3,8 Z M12,14 L14,14 L14,12 L12,12 L12,14 L12,14 Z M12,8 L14,8 L14,6 L12,6 L12,8 L12,8 Z M12,11 L14,11 L14,9 L12,9 L12,11 L12,11 Z M12,5 L14,5 L14,3 L12,3 L12,5 L12,5 Z M6,2 L8,2 L8,0 L6,0 L6,2 L6,2 Z M12,0 L12,2 L14,2 L14,0 L12,0 L12,0 Z M9,14 L11,14 L11,12 L9,12 L9,14 L9,14 Z M9,8 L11,8 L11,6 L9,6 L9,8 L9,8 Z M9,2 L11,2 L11,0 L9,0 L9,2 L9,2 Z" opacity=".54"/><polygon points="0 14 2 14 2 0 0 0"/></g></svg>`;
    const BORDER_TOP = `<svg class="o-icon"><g fill="#000000"><path d="M3,8 L5,8 L5,6 L3,6 L3,8 L3,8 Z M0,14 L2,14 L2,12 L0,12 L0,14 L0,14 Z M6,14 L8,14 L8,12 L6,12 L6,14 L6,14 Z M6,11 L8,11 L8,9 L6,9 L6,11 L6,11 Z M3,14 L5,14 L5,12 L3,12 L3,14 L3,14 Z M0,11 L2,11 L2,9 L0,9 L0,11 L0,11 Z M6,8 L8,8 L8,6 L6,6 L6,8 L6,8 Z M0,5 L2,5 L2,3 L0,3 L0,5 L0,5 Z M0,8 L2,8 L2,6 L0,6 L0,8 L0,8 Z M12,8 L14,8 L14,6 L12,6 L12,8 L12,8 Z M12,11 L14,11 L14,9 L12,9 L12,11 L12,11 Z M12,5 L14,5 L14,3 L12,3 L12,5 L12,5 Z M6,5 L8,5 L8,3 L6,3 L6,5 L6,5 Z M9,14 L11,14 L11,12 L9,12 L9,14 L9,14 Z M9,8 L11,8 L11,6 L9,6 L9,8 L9,8 Z M12,14 L14,14 L14,12 L12,12 L12,14 L12,14 Z" opacity=".54"/><polygon points="0 0 0 2 14 2 14 0"/></g></svg>`;
    const BORDER_RIGHT = `<svg class="o-icon"><g fill="#000000"><path d="M0,2 L2,2 L2,0 L0,0 L0,2 L0,2 Z M3,2 L5,2 L5,0 L3,0 L3,2 L3,2 Z M3,8 L5,8 L5,6 L3,6 L3,8 L3,8 Z M3,14 L5,14 L5,12 L3,12 L3,14 L3,14 Z M0,5 L2,5 L2,3 L0,3 L0,5 L0,5 Z M0,8 L2,8 L2,6 L0,6 L0,8 L0,8 Z M0,14 L2,14 L2,12 L0,12 L0,14 L0,14 Z M0,11 L2,11 L2,9 L0,9 L0,11 L0,11 Z M9,8 L11,8 L11,6 L9,6 L9,8 L9,8 Z M6,14 L8,14 L8,12 L6,12 L6,14 L6,14 Z M9,14 L11,14 L11,12 L9,12 L9,14 L9,14 Z M6,2 L8,2 L8,0 L6,0 L6,2 L6,2 Z M9,2 L11,2 L11,0 L9,0 L9,2 L9,2 Z M6,11 L8,11 L8,9 L6,9 L6,11 L6,11 Z M6,5 L8,5 L8,3 L6,3 L6,5 L6,5 Z M6,8 L8,8 L8,6 L6,6 L6,8 L6,8 Z" opacity=".54"/><polygon points="12 0 12 14 14 14 14 0"/></g></svg>`;
    const BORDER_BOTTOM = `<svg class="o-icon"><g fill="#000000"><path d="M5,0 L3,0 L3,2 L5,2 L5,0 L5,0 Z M8,6 L6,6 L6,8 L8,8 L8,6 L8,6 Z M8,9 L6,9 L6,11 L8,11 L8,9 L8,9 Z M11,6 L9,6 L9,8 L11,8 L11,6 L11,6 Z M5,6 L3,6 L3,8 L5,8 L5,6 L5,6 Z M11,0 L9,0 L9,2 L11,2 L11,0 L11,0 Z M8,3 L6,3 L6,5 L8,5 L8,3 L8,3 Z M8,0 L6,0 L6,2 L8,2 L8,0 L8,0 Z M2,9 L0,9 L0,11 L2,11 L2,9 L2,9 Z M12,11 L14,11 L14,9 L12,9 L12,11 L12,11 Z M12,5 L14,5 L14,3 L12,3 L12,5 L12,5 Z M12,8 L14,8 L14,6 L12,6 L12,8 L12,8 Z M12,0 L12,2 L14,2 L14,0 L12,0 L12,0 Z M2,0 L0,0 L0,2 L2,2 L2,0 L2,0 Z M2,3 L0,3 L0,5 L2,5 L2,3 L2,3 Z M2,6 L0,6 L0,8 L2,8 L2,6 L2,6 Z" opacity=".54"/><polygon points="0 14 14 14 14 12 0 12"/></g></svg>`;
    const BORDER_CLEAR = `<svg class="o-icon"><path fill="#000000" fill-rule="evenodd" d="M6,14 L8,14 L8,12 L6,12 L6,14 L6,14 Z M3,8 L5,8 L5,6 L3,6 L3,8 L3,8 Z M3,2 L5,2 L5,0 L3,0 L3,2 L3,2 Z M6,11 L8,11 L8,9 L6,9 L6,11 L6,11 Z M3,14 L5,14 L5,12 L3,12 L3,14 L3,14 Z M0,5 L2,5 L2,3 L0,3 L0,5 L0,5 Z M0,14 L2,14 L2,12 L0,12 L0,14 L0,14 Z M0,2 L2,2 L2,0 L0,0 L0,2 L0,2 Z M0,8 L2,8 L2,6 L0,6 L0,8 L0,8 Z M6,8 L8,8 L8,6 L6,6 L6,8 L6,8 Z M0,11 L2,11 L2,9 L0,9 L0,11 L0,11 Z M12,11 L14,11 L14,9 L12,9 L12,11 L12,11 Z M12,14 L14,14 L14,12 L12,12 L12,14 L12,14 Z M12,8 L14,8 L14,6 L12,6 L12,8 L12,8 Z M12,5 L14,5 L14,3 L12,3 L12,5 L12,5 Z M12,0 L12,2 L14,2 L14,0 L12,0 L12,0 Z M6,2 L8,2 L8,0 L6,0 L6,2 L6,2 Z M9,2 L11,2 L11,0 L9,0 L9,2 L9,2 Z M6,5 L8,5 L8,3 L6,3 L6,5 L6,5 Z M9,14 L11,14 L11,12 L9,12 L9,14 L9,14 Z M9,8 L11,8 L11,6 L9,6 L9,8 L9,8 Z" transform="translate(2 2)" opacity=".54"/></svg>`;
    const PLUS = `<svg class="o-icon"><path fill="#000000" d="M8,0 L10,0 L10,8 L18,8 L18,10 L10,10 L10,18 L8,18 L8,10 L0,10 L0,8 L8,8"/></svg>`;
    const LIST = `<svg class="o-icon" viewBox="0 0 384 384"><rect x="0" y="277.333" width="384" height="42.667"/><rect x="0" y="170.667" width="384" height="42.667"/><rect x="0" y="64" width="384" height="42.667"/></svg>`;

    const Component$b = owl__namespace.Component;
    const { useState: useState$c, hooks: hooks$2 } = owl__namespace;
    const { useExternalListener: useExternalListener$4 } = hooks$2;
    const { xml: xml$d, css: css$d } = owl__namespace.tags;
    const PREVIEW_TEMPLATE$2 = xml$d /* xml */ `
    <div class="o-cf-preview-line"
         t-attf-style="font-weight:{{currentStyle.bold ?'bold':'normal'}};
                       text-decoration:{{currentStyle.strikethrough ? 'line-through':'none'}};
                       font-style:{{currentStyle.italic?'italic':'normal'}};
                       color:{{currentStyle.textColor}};
                       background-color:{{currentStyle.fillColor}};"
         t-esc="previewText || env._t('${terms.PREVIEWTEXT}')" />
`;
    const TEMPLATE$b = xml$d /* xml */ `
<div>
    <div class="o-section-title" t-esc="env._t('${terms.CF_TITLE}')"></div>
    <div class="o-cf-title-text" t-esc="env._t('${terms.IS_RULE}')"></div>
    <select t-model="state.condition.operator" class="o-input o-cell-is-operator">
        <t t-foreach="Object.keys(cellIsOperators)" t-as="op" t-key="op_index">
            <option t-att-value="op" t-esc="cellIsOperators[op]"/>
        </t>
    </select>
    <input type="text" placeholder="Value" t-model="state.condition.value1" class="o-input o-cell-is-value"/>
    <t t-if="state.condition.operator === 'Between' || state.condition.operator === 'NotBetween'">
        <input type="text" placeholder="and value" t-model="state.condition.value2" class="o-input"/>
    </t>
    <div class="o-cf-title-text" t-esc="env._t('${terms.FORMATTING_STYLE}')"></div>

    <t t-call="${PREVIEW_TEMPLATE$2}">
        <t t-set="currentStyle" t-value="state.style"/>
    </t>
    <div class="o-tools">
        <div class="o-tool" t-att-title="env._t('${terms.BOLD}')" t-att-class="{active:state.style.bold}" t-on-click="toggleTool('bold')">
            ${BOLD_ICON}
        </div>
        <div class="o-tool" t-att-title="env._t('${terms.ITALIC}')" t-att-class="{active:state.style.italic}" t-on-click="toggleTool('italic')">
            ${ITALIC_ICON}
        </div>
        <div class="o-tool" t-att-title="env._t('${terms.STRIKETHROUGH}')" t-att-class="{active:state.style.strikethrough}"
             t-on-click="toggleTool('strikethrough')">${STRIKE_ICON}
        </div>
        <div class="o-tool o-dropdown o-with-color">
              <span t-att-title="env._t('${terms.TEXTCOLOR}')" t-attf-style="border-color:{{state.style.textColor}}"
                    t-on-click.stop="toggleMenu('textColorTool')">${TEXT_COLOR_ICON}</span>
                    <ColorPicker t-if="state.textColorTool" t-on-color-picked="setColor('textColor')" t-key="textColor"/>
        </div>
        <div class="o-divider"/>
        <div class="o-tool  o-dropdown o-with-color">
              <span t-att-title="env._t('${terms.FILLCOLOR}')" t-attf-style="border-color:{{state.style.fillColor}}"
                    t-on-click.stop="toggleMenu('fillColorTool')">${FILL_COLOR_ICON}</span>
                    <ColorPicker t-if="state.fillColorTool" t-on-color-picked="setColor('fillColor')" t-key="fillColor"/>
        </div>
    </div>
    <div class="o-sidePanelButtons">
      <button t-on-click="onCancel" class="o-sidePanelButton o-cf-cancel" t-esc="env._t('${terms.CANCEL}')"></button>
      <button t-on-click="onSave" class="o-sidePanelButton o-cf-save" t-esc="env._t('${terms.SAVE}')"></button>
    </div>
</div>
`;
    const CSS$b = css$d /* scss */ `
  .o-cf-title-text {
    font-size: 12px;
    line-height: 14px;
    margin-bottom: 6px;
    margin-top: 18px;
  }
  .o-cf-preview-line {
    border: 1px solid darkgrey;
    padding: 10px;
  }
`;
    class CellIsRuleEditor extends Component$b {
        constructor() {
            super(...arguments);
            // @ts-ignore   used in XML template
            this.cellIsOperators = cellIsOperators;
            this.cf = this.props.conditionalFormat;
            this.rule = this.cf.rule;
            this.state = useState$c({
                condition: {
                    operator: this.rule && this.rule.operator ? this.rule.operator : "Equal",
                    value1: this.rule && this.rule.values.length > 0 ? this.rule.values[0] : "",
                    value2: this.cf && this.rule.values.length > 1 ? this.rule.values[1] : "",
                },
                textColorTool: false,
                fillColorTool: false,
                style: {
                    fillColor: this.cf && this.rule.style.fillColor,
                    textColor: this.cf && this.rule.style.textColor,
                    bold: this.cf && this.rule.style.bold,
                    italic: this.cf && this.rule.style.italic,
                    strikethrough: this.cf && this.rule.style.strikethrough,
                },
            });
            useExternalListener$4(window, "click", this.closeMenus);
        }
        toggleMenu(tool) {
            const current = this.state[tool];
            this.closeMenus();
            this.state[tool] = !current;
        }
        toggleTool(tool) {
            this.state.style[tool] = !this.state.style[tool];
            this.closeMenus();
        }
        setColor(target, ev) {
            const color = ev.detail.color;
            this.state.style[target] = color;
            this.closeMenus();
        }
        closeMenus() {
            this.state.textColorTool = false;
            this.state.fillColorTool = false;
        }
        onSave() {
            const newStyle = {};
            const style = this.state.style;
            if (style.bold !== undefined) {
                newStyle.bold = style.bold;
            }
            if (style.italic !== undefined) {
                newStyle.italic = style.italic;
            }
            if (style.strikethrough !== undefined) {
                newStyle.strikethrough = style.strikethrough;
            }
            if (style.fillColor) {
                newStyle.fillColor = style.fillColor;
            }
            if (style.textColor) {
                newStyle.textColor = style.textColor;
            }
            this.trigger("modify-rule", {
                rule: {
                    type: "CellIsRule",
                    operator: this.state.condition.operator,
                    values: [this.state.condition.value1, this.state.condition.value2],
                    stopIfTrue: false,
                    style: newStyle,
                },
            });
        }
        onCancel() {
            this.trigger("cancel-edit");
        }
    }
    CellIsRuleEditor.template = TEMPLATE$b;
    CellIsRuleEditor.style = CSS$b;
    CellIsRuleEditor.components = { ColorPicker };

    const Component$a = owl__namespace.Component;
    const { useState: useState$b, hooks: hooks$1 } = owl__namespace;
    const { useExternalListener: useExternalListener$3 } = hooks$1;
    const { xml: xml$c, css: css$c } = owl__namespace.tags;
    const PREVIEW_TEMPLATE$1 = xml$c /* xml */ `
    <div class="o-cf-preview-gradient" t-attf-style="background-image: linear-gradient(to right, #{{colorNumberString(state.minimum.color)}}, #{{colorNumberString(state.maximum.color)}})">
      <div t-esc="previewText">Preview text</div>
    </div>
`;
    const THRESHOLD_TEMPLATE = xml$c /* xml */ `
  <div t-attf-class="o-threshold o-threshold-{{thresholdType}}">
      <div class="o-tools">
        <div class="o-tool  o-dropdown o-with-color">
        <span title="Fill Color"  t-attf-style="border-color:#{{colorNumberString(threshold.color)}}"
              t-on-click.stop="toggleMenu(thresholdType+'ColorTool')">${FILL_COLOR_ICON}</span>
              <ColorPicker t-if="state[thresholdType+'ColorTool']" t-on-color-picked="setColor(thresholdType)"/>
          </div>
      </div>
      <select name="valueType" t-model="threshold.type" t-on-click="closeMenus">
          <option value="value">Cell values</option>
<!--          <option value="number">Fixed number</option>--> <!-- not yet implemented -->
<!--          <option value="percentage">Percentage</option>-->
<!--          <option value="percentile">Percentile</option>-->
<!--          <option value="formula">Formula</option>-->
      </select>

      <input type="text" t-model="threshold.value" class="o-threshold-value"
            t-att-disabled="threshold.type !== 'number'"/>
  </div>`;
    const TEMPLATE$a = xml$c /* xml */ `
  <div>
      <div class="o-section-title">Format rules</div>
      <div class="o-cf-title-text">Preview</div>
      <t t-call="${PREVIEW_TEMPLATE$1}"/>
      <div class="o-cf-title-text">Minpoint</div>
      <t t-call="${THRESHOLD_TEMPLATE}">
          <t t-set="threshold" t-value="state.minimum" ></t>
          <t t-set="thresholdType" t-value="'minimum'" ></t>
      </t>
      <div class="o-cf-title-text">MaxPoint</div>
      <t t-call="${THRESHOLD_TEMPLATE}">
          <t t-set="threshold" t-value="state.maximum" ></t>
          <t t-set="thresholdType" t-value="'maximum'" ></t>
      </t>
      <div class="o-sidePanelButtons">
        <button t-on-click="onCancel" class="o-sidePanelButton o-cf-cancel">Cancel</button>
        <button t-on-click="onSave" class="o-sidePanelButton o-cf-save">Save</button>
      </div>
  </div>`;
    const CSS$a = css$c /* scss */ `
  .o-cf-title-text {
    font-size: 12px;
    line-height: 14px;
    margin-bottom: 6px;
    margin-top: 18px;
  }
  .o-threshold {
    display: flex;
    flex-direction: horizontal;

    .o-threshold-value {
      width: 5em;
      margin-left: 15px;
      margin-right: 15px;
    }
  }
  .o-cf-preview-gradient {
    border: 1px solid darkgrey;
    padding: 10px;
  }
`;
    class ColorScaleRuleEditor extends Component$a {
        constructor() {
            super(...arguments);
            this.cf = this.props.conditionalFormat;
            this.colorNumberString = colorNumberString;
            this.rule = this.cf ? this.cf.rule : null;
            this.state = useState$b({
                minimum: this.rule
                    ? Object.assign({}, this.rule.minimum)
                    : { color: 0xffffff, type: "value", value: null },
                maximum: this.rule
                    ? Object.assign({}, this.rule.maximum)
                    : { color: 0x000000, type: "value", value: null },
                midpoint: this.rule && Object.assign({}, this.rule.midpoint)
                    ? this.rule.midpoint
                    : { color: 0xffffff, type: "value", value: null },
                maximumColorTool: false,
                minimumColorTool: false,
            });
            useExternalListener$3(window, "click", this.closeMenus);
        }
        toggleMenu(tool) {
            const current = this.state[tool];
            this.closeMenus();
            this.state[tool] = !current;
        }
        toggleTool(tool) {
            this.closeMenus();
        }
        setColor(target, ev) {
            const color = ev.detail.color;
            this.state[target].color = Number.parseInt(color.substr(1), 16);
            this.closeMenus();
        }
        closeMenus() {
            this.state.minimumColorTool = false;
            this.state.maximumColorTool = false;
        }
        onSave() {
            this.trigger("modify-rule", {
                rule: {
                    type: "ColorScaleRule",
                    minimum: this.state.minimum,
                    maximum: this.state.maximum,
                    midpoint: this.state.midpoint,
                },
            });
        }
        onCancel() {
            this.trigger("cancel-edit");
        }
    }
    ColorScaleRuleEditor.template = TEMPLATE$a;
    ColorScaleRuleEditor.style = CSS$a;
    ColorScaleRuleEditor.components = { ColorPicker };

    const Component$9 = owl__namespace.Component;
    const { useState: useState$a } = owl__namespace;
    const { xml: xml$b, css: css$b } = owl__namespace.tags;
    // TODO vsc: add ordering of rules
    const PREVIEW_TEMPLATE = xml$b /* xml */ `
<div class="o-cf-preview">
  <div t-att-style="getStyle(cf.rule)" class="o-cf-preview-image">
    123
  </div>
  <div class="o-cf-preview-description">
    <div class="o-cf-preview-ruletype">
      <div class="o-cf-preview-description-rule">
        <t t-esc="getDescription(cf)" />
      </div>
      <div class="o-cf-preview-description-values">
      <t t-if="cf.rule.values">
        <t t-esc="cf.rule.values[0]" />
        <t t-if="cf.rule.values[1]">
          and <t t-esc="cf.rule.values[1]"/>
        </t>
      </t>
      </div>
    </div>
    <div class="o-cf-preview-range" t-esc="cf.ranges"/>
  </div>
  <div class="o-cf-delete">
    <div class="o-cf-delete-button" t-on-click.stop="onDeleteClick(cf)" aria-label="Remove rule">
      x
    </div>
  </div>
</div>`;
    const TEMPLATE$9 = xml$b /* xml */ `
  <div class="o-cf">
    <t t-if="state.mode === 'list'">
      <div class="o-cf-preview-list" >
          <div t-on-click="onRuleClick(cf)" t-foreach="getters.getConditionalFormats()" t-as="cf" t-key="cf.id">
              <t t-call="${PREVIEW_TEMPLATE}"/>
          </div>
      </div>
    </t>
    <t t-if="state.mode === 'edit' || state.mode === 'add'" t-key="state.currentCF.id">
        <div class="o-cf-type-selector">
          <div class="o-cf-type-tab" t-att-class="{'o-cf-tab-selected': state.toRuleType === 'CellIsRule'}" t-on-click="setRuleType('CellIsRule')">Single Color</div>
          <div class="o-cf-type-tab" t-att-class="{'o-cf-tab-selected': state.toRuleType === 'ColorScaleRule'}" t-on-click="setRuleType('ColorScaleRule')">Color Scale</div>
        </div>
        <div class="o-cf-ruleEditor">
            <div class="o-section o-cf-range">
              <div class="o-section-title">Apply to range</div>
              <SelectionInput ranges="state.currentRanges" class="o-range" t-on-selection-changed="onRangesChanged"/>
            </div>
            <div class="o-cf-editor o-section">
              <t t-component="editors[state.currentCF.rule.type]"
                  t-key="state.currentCF.id"
                  conditionalFormat="state.currentCF"
                  t-on-cancel-edit="onCancel"
                  t-on-modify-rule="onSave" />
            </div>
        </div>
    </t>
    <div class="o-cf-add" t-if="state.mode === 'list'" t-on-click.prevent.stop="onAdd">
    + Add another rule
    </div>
  </div>`;
    const CSS$9 = css$b /* scss */ `
  .o-cf {
    min-width: 350px;
    .o-cf-type-selector {
      margin-top: 20px;
      display: flex;
      .o-cf-type-tab {
        cursor: pointer;
        flex-grow: 1;
        text-align: center;
      }
      .o-cf-tab-selected {
        text-decoration: underline;
      }
    }
    .o-cf-preview {
      background-color: #fff;
      border-bottom: 1px solid #ccc;
      cursor: pointer;
      display: flex;
      height: 60px;
      padding: 10px;
      position: relative;
      &:hover {
        background-color: rgba(0, 0, 0, 0.08);
      }
      &:not(:hover) .o-cf-delete-button {
        display: none;
      }
      .o-cf-preview-image {
        border: 1px solid lightgrey;
        height: 50px;
        line-height: 50px;
        margin-right: 15px;
        position: absolute;
        text-align: center;
        width: 50px;
      }
      .o-cf-preview-description {
        left: 65px;
        margin-bottom: auto;
        margin-right: 8px;
        margin-top: auto;
        position: relative;
        width: 142px;
        .o-cf-preview-description-rule {
          margin-bottom: 4px;
          overflow: hidden;
        }
        .o-cf-preview-description-values {
          overflow: hidden;
        }
        .o-cf-preview-range {
          text-overflow: ellipsis;
          font-size: 12px;
          overflow: hidden;
        }
      }
      .o-cf-delete {
        height: 56px;
        left: 90%;
        line-height: 56px;
        position: absolute;
      }
    }
    .o-cf-ruleEditor {
      .o-dropdown {
        position: relative;
        .o-dropdown-content {
          position: absolute;
          top: calc(100% + 5px);
          left: 0;
          z-index: 10;
          box-shadow: 1px 2px 5px 2px rgba(51, 51, 51, 0.15);
          background-color: #f6f6f6;

          .o-dropdown-item {
            padding: 7px 10px;
          }
          .o-dropdown-item:hover {
            background-color: rgba(0, 0, 0, 0.08);
          }
          .o-dropdown-line {
            display: flex;
            padding: 3px 6px;
            .o-line-item {
              width: 16px;
              height: 16px;
              margin: 1px 3px;
              &:hover {
                background-color: rgba(0, 0, 0, 0.08);
              }
            }
          }
        }
      }

      .o-tools {
        color: #333;
        font-size: 13px;
        cursor: default;
        display: flex;

        .o-tool {
          display: flex;
          align-items: center;
          margin: 2px;
          padding: 0 3px;
          border-radius: 2px;
        }

        .o-tool.active,
        .o-tool:not(.o-disabled):hover {
          background-color: rgba(0, 0, 0, 0.08);
        }

        .o-with-color > span {
          border-bottom: 4px solid;
          height: 16px;
          margin-top: 2px;
        }
        .o-with-color {
          .o-line-item:hover {
            outline: 1px solid gray;
          }
        }
        .o-border {
          .o-line-item {
            padding: 4px;
            margin: 1px;
          }
        }
      }
      .o-cell-content {
        font-size: 12px;
        font-weight: 500;
        padding: 0 12px;
        margin: 0;
        line-height: 35px;
      }
    }
    .o-cf-add {
      font-size: 14px;
      height: 36px;
      padding: 20px 24px 11px 24px;
      height: 44px;
      cursor: pointer;
    }
  }
`;
    class ConditionalFormattingPanel extends Component$9 {
        constructor(parent, props) {
            super(parent, props);
            this.colorNumberString = colorNumberString;
            this.getters = this.env.getters;
            //@ts-ignore --> used in XML template
            this.cellIsOperators = cellIsOperators;
            this.state = useState$a({
                currentCF: undefined,
                currentRanges: [],
                mode: "list",
                toRuleType: "CellIsRule",
            });
            this.editors = {
                CellIsRule: CellIsRuleEditor,
                ColorScaleRule: ColorScaleRuleEditor,
            };
            this.activeSheetId = this.getters.getActiveSheet();
            if (props.selection && this.getters.getRulesSelection(props.selection).length === 1) {
                this.openCf(this.getters.getRulesSelection(props.selection)[0]);
            }
        }
        async willUpdateProps(nextProps) {
            const newActiveSheetId = this.getters.getActiveSheet();
            if (newActiveSheetId !== this.activeSheetId) {
                this.activeSheetId = newActiveSheetId;
                this.resetState();
            }
            else if (nextProps.selection && nextProps.selection !== this.props.selection)
                if (nextProps.selection && this.getters.getRulesSelection(nextProps.selection).length === 1) {
                    this.openCf(this.getters.getRulesSelection(nextProps.selection)[0]);
                }
                else {
                    this.resetState();
                }
        }
        resetState() {
            this.state.currentCF = undefined;
            this.state.currentRanges = [];
            this.state.mode = "list";
            this.state.toRuleType = "CellIsRule";
        }
        getStyle(rule) {
            if (rule.type === "CellIsRule") {
                const cellRule = rule;
                const fontWeight = cellRule.style.bold ? "bold" : "normal";
                const fontDecoration = cellRule.style.strikethrough ? "line-through" : "none";
                const fontStyle = cellRule.style.italic ? "italic" : "normal";
                const color = cellRule.style.textColor || "none";
                const backgroundColor = cellRule.style.fillColor || "none";
                return `font-weight:${fontWeight};
               text-decoration:${fontDecoration};
               font-style:${fontStyle};
               color:${color};
               background-color:${backgroundColor};`;
            }
            else {
                const colorScale = rule;
                return `background-image: linear-gradient(to right, #${colorNumberString(colorScale.minimum.color)}, #${colorNumberString(colorScale.maximum.color)})`;
            }
        }
        getDescription(cf) {
            return cf.rule.type === "CellIsRule" ? cellIsOperators[cf.rule.operator] : "Color scale";
        }
        onSave(ev) {
            if (this.state.currentCF) {
                this.env.dispatch("ADD_CONDITIONAL_FORMAT", {
                    cf: {
                        rule: ev.detail.rule,
                        ranges: this.state.currentRanges,
                        id: this.state.mode === "edit" ? this.state.currentCF.id : uuidv4(),
                    },
                    sheet: this.getters.getActiveSheet(),
                });
            }
            this.state.mode = "list";
        }
        onCancel() {
            this.state.mode = "list";
            this.state.currentCF = undefined;
        }
        onDeleteClick(cf) {
            this.env.dispatch("REMOVE_CONDITIONAL_FORMAT", {
                id: cf.id,
                sheet: this.getters.getActiveSheet(),
            });
        }
        onRuleClick(cf) {
            this.state.mode = "edit";
            this.state.currentCF = cf;
            this.state.toRuleType = cf.rule.type === "CellIsRule" ? "CellIsRule" : "ColorScaleRule";
            this.state.currentRanges = this.state.currentCF.ranges;
        }
        openCf(cfId) {
            const rules = this.getters.getConditionalFormats();
            const cfIndex = rules.findIndex((c) => c.id === cfId);
            const cf = rules[cfIndex];
            if (cf) {
                this.state.mode = "edit";
                this.state.currentCF = cf;
                this.state.toRuleType = cf.rule.type === "CellIsRule" ? "CellIsRule" : "ColorScaleRule";
                this.state.currentRanges = this.state.currentCF.ranges;
            }
        }
        defaultCellIsRule() {
            return {
                rule: {
                    type: "CellIsRule",
                    operator: "Equal",
                    values: [],
                    style: { fillColor: "#FF0000" },
                },
                ranges: this.getters.getSelectedZones().map(this.getters.zoneToXC),
                id: uuidv4(),
            };
        }
        defaultColorScaleRule() {
            return {
                rule: {
                    minimum: { type: "value", color: 0 },
                    maximum: { type: "value", color: 0xeeffee },
                    type: "ColorScaleRule",
                },
                ranges: this.getters.getSelectedZones().map(this.getters.zoneToXC),
                id: uuidv4(),
            };
        }
        onAdd() {
            this.state.mode = "add";
            this.state.currentCF = this.defaultCellIsRule();
            this.state.currentRanges = this.state.currentCF.ranges;
        }
        setRuleType(ruleType) {
            if (ruleType === "ColorScaleRule") {
                this.state.currentCF = this.defaultColorScaleRule();
            }
            if (ruleType === "CellIsRule") {
                this.state.currentCF = this.defaultCellIsRule();
            }
            this.state.toRuleType = ruleType;
        }
        onRangesChanged({ detail }) {
            this.state.currentRanges = detail.ranges;
        }
    }
    ConditionalFormattingPanel.template = TEMPLATE$9;
    ConditionalFormattingPanel.style = CSS$9;
    ConditionalFormattingPanel.components = { CellIsRuleEditor, ColorScaleRuleEditor, SelectionInput };

    const sidePanelRegistry = new Registry();
    sidePanelRegistry.add("ConditionalFormatting", {
        title: _lt("Conditional formatting"),
        Body: ConditionalFormattingPanel,
    });
    sidePanelRegistry.add("ChartPanel", {
        title: _lt("Chart"),
        Body: ChartPanel,
    });

    const topbarComponentRegistry = new Registry();

    /**
     * This plugin manage the autofill.
     *
     * The way it works is the next one:
     * For each line (row if the direction is left/right, col otherwise), we create
     * a "AutofillGenerator" object which is used to compute the cells to
     * autofill.
     *
     * When we need to autofill a cell, we compute the origin cell in the source.
     *  EX: from A1:A2, autofill A3->A6.
     *      Target | Origin cell
     *        A3   |   A1
     *        A4   |   A2
     *        A5   |   A1
     *        A6   |   A2
     * When we have the origin, we take the associated cell in the AutofillGenerator
     * and we apply the modifier (AutofillModifier) associated to the content of the
     * cell.
     */
    /**
     * This class is used to generate the next values to autofill.
     * It's done from a selection (the source) and describe how the next values
     * should be computed.
     */
    class AutofillGenerator {
        constructor(cells, getters, direction) {
            this.index = 0;
            this.cells = cells;
            this.getters = getters;
            this.direction = direction;
        }
        /**
         * Get the next value to autofill
         */
        next() {
            const genCell = this.cells[this.index++ % this.cells.length];
            if (!genCell.rule) {
                return {
                    cellData: genCell.data,
                    tooltip: genCell.data.content ? { props: genCell.data.content } : undefined,
                };
            }
            const rule = genCell.rule;
            const { cellData, tooltip } = autofillModifiersRegistry
                .get(rule.type)
                .apply(rule, genCell.data, this.getters, this.direction);
            return {
                cellData: Object.assign({}, genCell.data, cellData),
                tooltip,
            };
        }
    }
    /**
     * Autofill Plugin
     *
     */
    class AutofillPlugin extends BasePlugin {
        constructor() {
            super(...arguments);
            this.lastCellSelected = {};
        }
        // ---------------------------------------------------------------------------
        // Command Handling
        // ---------------------------------------------------------------------------
        allowDispatch(cmd) {
            switch (cmd.type) {
                case "AUTOFILL_SELECT":
                    const sheetId = this.getters.getActiveSheet();
                    this.lastCellSelected.col =
                        cmd.col === -1
                            ? this.lastCellSelected.col
                            : clip(cmd.col, 0, this.getters.getNumberCols(sheetId));
                    this.lastCellSelected.row =
                        cmd.row === -1
                            ? this.lastCellSelected.row
                            : clip(cmd.row, 0, this.getters.getNumberRows(sheetId));
                    if (this.lastCellSelected.col !== undefined && this.lastCellSelected.row !== undefined) {
                        return { status: "SUCCESS" };
                    }
                    return { status: "CANCELLED", reason: 17 /* InvalidAutofillSelection */ };
                case "AUTOFILL_AUTO":
                    const zone = this.getters.getSelectedZone();
                    return zone.top === zone.bottom
                        ? { status: "SUCCESS" }
                        : { status: "CANCELLED", reason: 0 /* Unknown */ };
            }
            return { status: "SUCCESS" };
        }
        handle(cmd) {
            switch (cmd.type) {
                case "AUTOFILL":
                    this.autofill(true);
                    break;
                case "AUTOFILL_SELECT":
                    this.select(cmd.col, cmd.row);
                    break;
                case "AUTOFILL_AUTO":
                    this.autofillAuto();
                    break;
                case "AUTOFILL_CELL":
                    const sheet = this.getters.getActiveSheet();
                    this.dispatch("UPDATE_CELL", {
                        sheet,
                        col: cmd.col,
                        row: cmd.row,
                        style: cmd.style,
                        border: cmd.border,
                        content: cmd.content,
                        format: cmd.format,
                    });
            }
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        getAutofillTooltip() {
            return this.tooltip;
        }
        // ---------------------------------------------------------------------------
        // Private methods
        // ---------------------------------------------------------------------------
        /**
         * Autofill the autofillZone from the current selection
         * @param apply Flag set to true to apply the autofill in the model. It's
         *              usefull to set it to false when we need to fill the tooltip
         */
        autofill(apply) {
            if (!this.autofillZone || this.direction === undefined) {
                this.tooltip = undefined;
                return;
            }
            const source = this.getters.getSelectedZone();
            const target = this.autofillZone;
            switch (this.direction) {
                case 1 /* DOWN */:
                    for (let col = source.left; col <= source.right; col++) {
                        const xcs = [];
                        for (let row = source.top; row <= source.bottom; row++) {
                            xcs.push(toXC(col, row));
                        }
                        const generator = this.createGenerator(xcs);
                        for (let row = target.top; row <= target.bottom; row++) {
                            this.computeNewCell(generator, col, row, apply);
                        }
                    }
                    break;
                case 0 /* UP */:
                    for (let col = source.left; col <= source.right; col++) {
                        const xcs = [];
                        for (let row = source.bottom; row >= source.top; row--) {
                            xcs.push(toXC(col, row));
                        }
                        const generator = this.createGenerator(xcs);
                        for (let row = target.bottom; row >= target.top; row--) {
                            this.computeNewCell(generator, col, row, apply);
                        }
                    }
                    break;
                case 2 /* LEFT */:
                    for (let row = source.top; row <= source.bottom; row++) {
                        const xcs = [];
                        for (let col = source.right; col >= source.left; col--) {
                            xcs.push(toXC(col, row));
                        }
                        const generator = this.createGenerator(xcs);
                        for (let col = target.right; col >= target.left; col--) {
                            this.computeNewCell(generator, col, row, apply);
                        }
                    }
                    break;
                case 3 /* RIGHT */:
                    for (let row = source.top; row <= source.bottom; row++) {
                        const xcs = [];
                        for (let col = source.left; col <= source.right; col++) {
                            xcs.push(toXC(col, row));
                        }
                        const generator = this.createGenerator(xcs);
                        for (let col = target.left; col <= target.right; col++) {
                            this.computeNewCell(generator, col, row, apply);
                        }
                    }
                    break;
            }
            if (apply) {
                const zone = union(this.getters.getSelectedZone(), this.autofillZone);
                this.autofillZone = undefined;
                this.lastCellSelected = {};
                this.direction = undefined;
                this.tooltip = undefined;
                this.dispatch("SET_SELECTION", {
                    zones: [zone],
                    anchor: [zone.left, zone.top],
                });
            }
        }
        /**
         * Select a cell which becomes the last cell of the autofillZone
         */
        select(col, row) {
            const source = this.getters.getSelectedZone();
            if (isInside(col, row, source)) {
                this.autofillZone = undefined;
                return;
            }
            this.direction = this.getDirection(col, row);
            switch (this.direction) {
                case 0 /* UP */:
                    this.saveZone(row, source.top - 1, source.left, source.right);
                    break;
                case 1 /* DOWN */:
                    this.saveZone(source.bottom + 1, row, source.left, source.right);
                    break;
                case 2 /* LEFT */:
                    this.saveZone(source.top, source.bottom, col, source.left - 1);
                    break;
                case 3 /* RIGHT */:
                    this.saveZone(source.top, source.bottom, source.right + 1, col);
                    break;
            }
            this.autofill(false);
        }
        /**
         * Computes the autofillZone to autofill when the user double click on the
         * autofiller
         */
        autofillAuto() {
            const zone = this.getters.getSelectedZone();
            let col = zone.left;
            let row = zone.bottom;
            if (col > 0) {
                let left = this.getters.getCell(col - 1, row);
                while (left && left.content) {
                    row += 1;
                    left = this.getters.getCell(col - 1, row);
                }
            }
            if (row === zone.bottom) {
                col = zone.right;
                if (col <= this.getters.getNumberCols(this.getters.getActiveSheet())) {
                    let right = this.getters.getCell(col + 1, row);
                    while (right && right.content) {
                        row += 1;
                        right = this.getters.getCell(col + 1, row);
                    }
                }
            }
            if (row !== zone.bottom) {
                this.select(zone.left, row - 1);
                this.autofill(true);
            }
        }
        /**
         * Generate the next cell
         */
        computeNewCell(generator, col, row, apply) {
            const { cellData, tooltip } = generator.next();
            const { col: originCol, row: originRow, content, style, border, format } = cellData;
            this.tooltip = tooltip;
            if (apply) {
                this.dispatch("AUTOFILL_CELL", {
                    originCol,
                    originRow,
                    col,
                    row,
                    content,
                    style,
                    border,
                    format,
                });
            }
        }
        /**
         * Get the rule associated to the current cell
         */
        getRule(cell, cells) {
            const rules = autofillRulesRegistry.getAll().sort((a, b) => a.sequence - b.sequence);
            const rule = rules.find((rule) => rule.condition(cell, cells));
            return rule && rule.generateRule(cell, cells);
        }
        /**
         * Create the generator to be able to autofill the next cells.
         */
        createGenerator(source) {
            const nextCells = [];
            const cellsData = [];
            for (let xc of source) {
                const [col, row] = toCartesian(xc);
                const cell = this.getters.getCell(col, row);
                let cellData = {
                    col,
                    row,
                    cell,
                };
                cellsData.push(cellData);
            }
            const cells = cellsData.map((cellData) => cellData.cell);
            for (let cellData of cellsData) {
                let rule;
                if (cellData && cellData.cell && cellData.cell.content) {
                    rule = this.getRule(cellData.cell, cells);
                }
                else {
                    rule = { type: "COPY_MODIFIER" };
                }
                const data = {
                    row: cellData.row,
                    col: cellData.col,
                    content: cellData.cell ? cellData.cell.content : undefined,
                    style: cellData.cell ? cellData.cell.style : undefined,
                    border: cellData.cell ? cellData.cell.border : undefined,
                    format: cellData.cell ? cellData.cell.format : undefined,
                };
                nextCells.push({ data, rule });
            }
            return new AutofillGenerator(nextCells, this.getters, this.direction);
        }
        saveZone(top, bottom, left, right) {
            this.autofillZone = { top, bottom, left, right };
        }
        /**
         * Compute the direction of the autofill from the last selected zone and
         * a given cell (col, row)
         */
        getDirection(col, row) {
            const source = this.getters.getSelectedZone();
            const position = {
                up: { number: source.top - row, value: 0 /* UP */ },
                down: { number: row - source.bottom, value: 1 /* DOWN */ },
                left: { number: source.left - col, value: 2 /* LEFT */ },
                right: { number: col - source.right, value: 3 /* RIGHT */ },
            };
            if (Object.values(position)
                .map((x) => (x.number > 0 ? 1 : 0))
                .reduce((acc, value) => acc + value) === 1) {
                return Object.values(position).find((x) => (x.number > 0 ? 1 : 0)).value;
            }
            const first = position.up.number > 0 ? "up" : "down";
            const second = position.left.number > 0 ? "left" : "right";
            return Math.abs(position[first].number) >= Math.abs(position[second].number)
                ? position[first].value
                : position[second].value;
        }
        // ---------------------------------------------------------------------------
        // Grid rendering
        // ---------------------------------------------------------------------------
        drawGrid(renderingContext) {
            if (!this.autofillZone) {
                return;
            }
            const { viewport, ctx, thinLineWidth } = renderingContext;
            const [x, y, width, height] = this.getters.getRect(this.autofillZone, viewport);
            if (width > 0 && height > 0) {
                ctx.strokeStyle = "black";
                ctx.lineWidth = thinLineWidth;
                ctx.setLineDash([3]);
                ctx.strokeRect(x, y, width, height);
                ctx.setLineDash([]);
            }
        }
    }
    AutofillPlugin.layers = [5 /* Autofill */];
    AutofillPlugin.getters = ["getAutofillTooltip"];
    AutofillPlugin.modes = ["normal", "readonly"];

    /**
     * Tokenizer
     *
     * A tokenizer is a piece of code whose job is to transform a string into a list
     * of "tokens". For example, "(12+" is converted into:
     *   [{type: "LEFT_PAREN", value: "("},
     *    {type: "NUMBER", value: "12"},
     *    {type: "OPERATOR", value: "+"}]
     *
     * As the example shows, a tokenizer does not care about the meaning behind those
     * tokens. It only cares about the structure.
     *
     * The tokenizer is usually the first step in a compilation pipeline.  Also, it
     * is useful for the composer, which needs to be able to work with incomplete
     * formulas.
     */
    const dependencyIdentifierRegex = /^[S|N]?\d+/;
    const functions$3 = functionRegistry.content;
    const OPERATORS = "+,-,*,/,:,=,<>,>=,>,<=,<,%,^,&".split(",");
    function tokenize(str) {
        const chars = str.split("");
        const result = [];
        let tokenCount = 0;
        while (chars.length) {
            tokenCount++;
            if (tokenCount > 100) {
                throw new Error(_lt("This formula has over 100 parts. It can't be processed properly, consider splitting it into multiple cells"));
            }
            let token = tokenizeSpace(chars) ||
                tokenizeMisc(chars) ||
                tokenizeOperator(chars) ||
                tokenizeString(chars) ||
                tokenizeDebugger(chars) ||
                tokenizeNormalizedReferences(chars) ||
                tokenizeNumber(chars) ||
                tokenizeSymbol(chars);
            if (!token) {
                token = { type: "UNKNOWN", value: chars.shift() };
            }
            result.push(token);
        }
        return result;
    }
    const FORMULA_REF_IDENTIFIER = "|";
    function tokenizeNormalizedReferences(chars) {
        if (chars[0] === FORMULA_REF_IDENTIFIER) {
            chars.shift(); // consume the | even if it is incorrect
            const match = chars.join("").match(dependencyIdentifierRegex);
            if (match) {
                chars.splice(0, match[0].length);
            }
            else {
                return null;
            }
            if (chars[0] === FORMULA_REF_IDENTIFIER) {
                chars.shift();
            }
            const value = match[0];
            switch (value[0]) {
                case "S":
                    return { type: "NORMALIZED_STRING", value: value.substring(1) };
                case "N":
                    return { type: "NORMALIZED_NUMBER", value: value.substring(1) };
                default:
                    return { type: "REFERENCE", value };
            }
        }
        return null;
    }
    function tokenizeDebugger(chars) {
        if (chars[0] === "?") {
            chars.shift();
            return { type: "DEBUGGER", value: "?" };
        }
        return null;
    }
    const misc = {
        ",": "COMMA",
        "(": "LEFT_PAREN",
        ")": "RIGHT_PAREN",
    };
    function tokenizeMisc(chars) {
        if (chars[0] in misc) {
            const value = chars.shift();
            const type = misc[value];
            return { type, value };
        }
        return null;
    }
    function startsWith(chars, op) {
        for (let i = 0; i < op.length; i++) {
            if (op[i] !== chars[i]) {
                return false;
            }
        }
        return true;
    }
    function tokenizeOperator(chars) {
        for (let op of OPERATORS) {
            if (startsWith(chars, op)) {
                chars.splice(0, op.length);
                return { type: "OPERATOR", value: op };
            }
        }
        return null;
    }
    function tokenizeNumber(chars) {
        const match = chars.join("").match(formulaNumberRegexp);
        if (match) {
            chars.splice(0, match[0].length);
            return { type: "NUMBER", value: match[0] };
        }
        return null;
    }
    function tokenizeString(chars) {
        if (chars[0] === '"') {
            const startChar = chars.shift();
            const letters = [startChar];
            while (chars[0] && (chars[0] !== startChar || letters[letters.length - 1] === "\\")) {
                letters.push(chars.shift());
            }
            if (chars[0] === '"') {
                letters.push(chars.shift());
            }
            return {
                type: "STRING",
                value: letters.join(""),
            };
        }
        return null;
    }
    const separatorRegexp = /\w|\.|!|\$/;
    /**
     * A "Symbol" is just basically any word-like element that can appear in a
     * formula, which is not a string. So:
     *   A1
     *   SUM
     *   CEILING.MATH
     *   A$1
     *   Sheet2!A2
     *   'Sheet 2'!A2
     *
     * are examples of symbols
     */
    function tokenizeSymbol(chars) {
        const result = [];
        // there are two main cases to manage: either something which starts with
        // a ', like 'Sheet 2'A2, or a word-like element.
        if (chars[0] === "'") {
            let lastChar = chars.shift();
            result.push(lastChar);
            while (chars[0]) {
                lastChar = chars.shift();
                result.push(lastChar);
                if (lastChar === "'") {
                    if (chars[0] && chars[0] === "'") {
                        lastChar = chars.shift();
                        result.push(lastChar);
                    }
                    else {
                        break;
                    }
                }
            }
            if (lastChar !== "'") {
                return {
                    type: "UNKNOWN",
                    value: result.join(""),
                };
            }
        }
        while (chars[0] && chars[0].match(separatorRegexp)) {
            result.push(chars.shift());
        }
        if (result.length) {
            const value = result.join("");
            const isFunction = value.toUpperCase() in functions$3;
            const type = isFunction ? "FUNCTION" : "SYMBOL";
            return { type, value };
        }
        return null;
    }
    const whiteSpaceRegexp = /\s/;
    function tokenizeSpace(chars) {
        let length = 0;
        while (chars[0] && chars[0].match(whiteSpaceRegexp)) {
            length++;
            chars.shift();
        }
        if (length) {
            return { type: "SPACE", value: " ".repeat(length) };
        }
        return null;
    }

    const functions$2 = functionRegistry.content;
    const UNARY_OPERATORS = ["-", "+"];
    const OP_PRIORITY = {
        "^": 30,
        "*": 20,
        "/": 20,
        "+": 15,
        "-": 15,
        "&": 13,
        ">": 10,
        "<>": 10,
        ">=": 10,
        "<": 10,
        "<=": 10,
        "=": 10,
    };
    const FUNCTION_BP = 6;
    function bindingPower(token) {
        switch (token.type) {
            case "NUMBER":
            case "SYMBOL":
                return 0;
            case "COMMA":
                return 3;
            case "LEFT_PAREN":
                return 5;
            case "RIGHT_PAREN":
                return 5;
            case "OPERATOR":
                return OP_PRIORITY[token.value] || 15;
        }
        throw new Error("?");
    }
    const cellReference = new RegExp(/\$?[A-Z]+\$?[0-9]+/, "i");
    const rangeReference = new RegExp(/^\s*\$?[A-Z]+\$?[0-9]+\s*(\s*:\s*\$?[A-Z]+\$?[0-9]+\s*)?$/, "i");
    function parsePrefix(current, tokens) {
        var _a;
        switch (current.type) {
            case "DEBUGGER":
                const next = parseExpression(tokens, 1000);
                next.debug = true;
                return next;
            case "NUMBER":
                return { type: "NUMBER", value: parseNumber(current.value) };
            case "NORMALIZED_NUMBER":
                return { type: "NORMALIZED_NUMBER", value: current.value };
            case "STRING":
                return { type: "STRING", value: current.value };
            case "NORMALIZED_STRING":
                return { type: "NORMALIZED_STRING", value: current.value };
            case "FUNCTION":
                if (tokens.shift().type !== "LEFT_PAREN") {
                    throw new Error(_lt("wrong function call"));
                }
                else {
                    const args = [];
                    if (tokens[0] && tokens[0].type !== "RIGHT_PAREN") {
                        if (tokens[0].type === "COMMA") {
                            args.push({ type: "UNKNOWN", value: "" });
                        }
                        else {
                            args.push(parseExpression(tokens, FUNCTION_BP));
                        }
                        while (((_a = tokens[0]) === null || _a === void 0 ? void 0 : _a.type) === "COMMA") {
                            tokens.shift();
                            const token = tokens[0];
                            if ((token === null || token === void 0 ? void 0 : token.type) === "RIGHT_PAREN") {
                                args.push({ type: "UNKNOWN", value: "" });
                                break;
                            }
                            else if ((token === null || token === void 0 ? void 0 : token.type) === "COMMA") {
                                args.push({ type: "UNKNOWN", value: "" });
                            }
                            else {
                                args.push(parseExpression(tokens, FUNCTION_BP));
                            }
                        }
                    }
                    const closingToken = tokens.shift();
                    if (!closingToken || closingToken.type !== "RIGHT_PAREN") {
                        throw new Error(_lt("wrong function call"));
                    }
                    const isAsync = functions$2[current.value.toUpperCase()].async;
                    const type = isAsync ? "ASYNC_FUNCALL" : "FUNCALL";
                    return { type, value: current.value, args };
                }
            case "REFERENCE":
                return {
                    type: "REFERENCE",
                    value: parseInt(current.value, 10),
                };
            case "SYMBOL":
                if (["TRUE", "FALSE"].includes(current.value.toUpperCase())) {
                    return { type: "BOOLEAN", value: current.value.toUpperCase() === "TRUE" };
                }
                else {
                    if (current.value) {
                        throw new Error(_lt("Invalid formula"));
                    }
                    return { type: "UNKNOWN", value: current.value };
                }
            case "LEFT_PAREN":
                const result = parseExpression(tokens, 5);
                if (!tokens.length || tokens[0].type !== "RIGHT_PAREN") {
                    throw new Error(_lt("unmatched left parenthesis"));
                }
                tokens.shift();
                return result;
            default:
                if (current.type === "OPERATOR" && UNARY_OPERATORS.includes(current.value)) {
                    return {
                        type: "UNARY_OPERATION",
                        value: current.value,
                        right: parseExpression(tokens, OP_PRIORITY[current.value]),
                    };
                }
                throw new Error(_lt("nope")); //todo: provide explicit error
        }
    }
    function parseInfix(left, current, tokens) {
        if (current.type === "OPERATOR") {
            const bp = bindingPower(current);
            const right = parseExpression(tokens, bp);
            return {
                type: "BIN_OPERATION",
                value: current.value,
                left,
                right,
            };
        }
        throw new Error(_lt("nope")); //todo: provide explicit error
    }
    function parseExpression(tokens, bp) {
        const token = tokens.shift();
        if (!token) {
            throw new Error(_lt("invalid expression"));
        }
        let expr = parsePrefix(token, tokens);
        while (tokens[0] && bindingPower(tokens[0]) > bp) {
            expr = parseInfix(expr, tokens.shift(), tokens);
        }
        return expr;
    }
    /**
     * Parse an expression (as a string) into an AST.
     */
    function parse(str) {
        const tokens = tokenize(str).filter((x) => x.type !== "SPACE");
        if (tokens[0].type === "OPERATOR" && tokens[0].value === "=") {
            tokens.splice(0, 1);
        }
        const result = parseExpression(tokens, 0);
        if (tokens.length) {
            throw new Error(_lt("invalid expression"));
        }
        return result;
    }
    /**
     * Converts an ast formula to the corresponding string
     */
    function astToFormula(ast, dependencies) {
        switch (ast.type) {
            case "FUNCALL":
            case "ASYNC_FUNCALL":
                const args = ast.args.map((arg) => astToFormula(arg, dependencies));
                return `${ast.value}(${args.join(",")})`;
            case "NUMBER":
                return ast.value.toString();
            case "NORMALIZED_STRING":
                return `"${dependencies[ast.value]}"`;
            case "NORMALIZED_NUMBER":
            case "REFERENCE":
                return dependencies[ast.value].toString();
            case "STRING":
                return ast.value;
            case "BOOLEAN":
                return ast.value ? "TRUE" : "FALSE";
            case "UNARY_OPERATION":
                return ast.value + astToFormula(ast.right, dependencies);
            case "BIN_OPERATION":
                return (astToFormula(ast.left, dependencies) + ast.value + astToFormula(ast.right, dependencies));
            default:
                return ast.value;
        }
    }

    /**
     * Chart plugin
     *
     * This plugin creates and displays charts
     * */
    const GraphColors = [
        // the same colors as those used in odoo reporting
        "rgb(31,119,180)",
        "rgb(255,127,14)",
        "rgb(174,199,232)",
        "rgb(255,187,120)",
        "rgb(44,160,44)",
        "rgb(152,223,138)",
        "rgb(214,39,40)",
        "rgb(255,152,150)",
        "rgb(148,103,189)",
        "rgb(197,176,213)",
        "rgb(140,86,75)",
        "rgb(196,156,148)",
        "rgb(227,119,194)",
        "rgb(247,182,210)",
        "rgb(127,127,127)",
        "rgb(199,199,199)",
        "rgb(188,189,34)",
        "rgb(219,219,141)",
        "rgb(23,190,207)",
        "rgb(158,218,229)",
    ];
    class ChartPlugin extends BasePlugin {
        constructor() {
            super(...arguments);
            this.chartFigures = new Set();
            // contains the configuration of the chart with it's values like they should be displayed,
            // as well as all the options needed for the chart library to work correctly
            this.chartRuntime = {};
            this.outOfDate = new Set();
        }
        allowDispatch(cmd) {
            const success = { status: "SUCCESS" };
            switch (cmd.type) {
                case "UPDATE_CHART":
                case "CREATE_CHART":
                    const invalidRanges = cmd.definition.dataSets.find((range) => !rangeReference.test(range.split("!").pop())) !==
                        undefined;
                    const invalidLabels = !rangeReference.test(cmd.definition.labelRange.split("!").pop());
                    return invalidRanges || invalidLabels
                        ? { status: "CANCELLED", reason: 16 /* InvalidChartDefinition */ }
                        : success;
                default:
                    return success;
            }
        }
        handle(cmd) {
            switch (cmd.type) {
                case "CREATE_CHART":
                    this.addChartFigure(cmd.sheetId, {
                        id: cmd.id,
                        data: this.createChartDefinition(cmd.definition, cmd.sheetId),
                        x: 0,
                        y: 0,
                        height: 500,
                        width: 800,
                        tag: "chart",
                    });
                    break;
                case "UPDATE_CHART": {
                    const chartDefinition = this.createChartDefinition(cmd.definition, this.getChartDefinition(cmd.id).sheetId);
                    this.dispatch("UPDATE_FIGURE", {
                        id: cmd.id,
                        data: chartDefinition,
                    });
                    this.history.updateLocalState(["chartRuntime", cmd.id], this.mapDefinitionToRuntime(chartDefinition));
                    break;
                }
                case "DELETE_FIGURE":
                    if (this.chartFigures.has(cmd.id)) {
                        const figures = new Set(this.chartFigures);
                        figures.delete(cmd.id);
                        this.history.updateLocalState(["chartFigures"], figures);
                        this.history.updateLocalState(["chartRuntime", cmd.id], undefined);
                    }
                    break;
                case "DUPLICATE_SHEET": {
                    const newSheetId = cmd.id;
                    const figures = [...this.chartFigures]
                        .map((figureId) => this.getters.getFigure(figureId))
                        .filter((figure) => figure.data.sheetId === cmd.sheet)
                        .map(deepCopy);
                    for (let figure of figures) {
                        figure.data.sheetId = newSheetId;
                        figure.id = uuidv4();
                        this.addChartFigure(newSheetId, figure);
                    }
                    break;
                }
                case "DELETE_SHEET":
                    const figures = new Set(this.chartFigures);
                    const runtime = { ...this.chartRuntime };
                    for (let figureId of this.chartFigures) {
                        const figure = this.getters.getFigure(figureId);
                        if (!figure) {
                            figures.delete(figureId);
                            delete runtime[figureId];
                        }
                    }
                    this.history.updateLocalState(["chartFigures"], figures);
                    this.history.updateLocalState(["chartRuntime"], runtime);
                    break;
                case "UPDATE_CELL":
                    for (let chartId of this.chartFigures) {
                        const chart = this.getChartDefinition(chartId);
                        if (this.isCellUsedInChart(chart, cmd.col, cmd.row)) {
                            this.outOfDate.add(chartId);
                        }
                    }
                    break;
            }
        }
        finalize(cmd) {
            switch (cmd.type) {
                case "EVALUATE_CELLS":
                case "START":
                    // if there was an async evaluation of cell, there is no way to know which was updated so all charts must be updated
                    for (let id in this.chartRuntime) {
                        this.outOfDate.add(id);
                    }
                    break;
            }
        }
        import(data) {
            for (let sheet of data.sheets) {
                for (let f of sheet.figures) {
                    if (f.tag === "chart") {
                        this.outOfDate.add(f.id);
                        this.chartFigures.add(f.id);
                    }
                }
            }
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        getChartRuntime(figureId) {
            if (this.outOfDate.has(figureId)) {
                this.chartRuntime[figureId] = this.mapDefinitionToRuntime(this.getChartDefinition(figureId));
                this.outOfDate.delete(figureId);
            }
            return this.chartRuntime[figureId];
        }
        // ---------------------------------------------------------------------------
        // Private
        // ---------------------------------------------------------------------------
        getChartDefinition(figureId) {
            return this.getters.getFigure(figureId).data;
        }
        createChartDefinition(createCommand, sheetId) {
            let dataSets = [];
            for (let range of createCommand.dataSets) {
                let zone = toZone(range);
                if (zone.left !== zone.right && zone.top !== zone.bottom) {
                    // It's a rectangle. We treat all columns (arbitrary) as different data series.
                    for (let column = zone.left; column <= zone.right; column++) {
                        const columnZone = {
                            left: column,
                            right: column,
                            top: zone.top,
                            bottom: zone.bottom,
                        };
                        dataSets.push(this.createDataset(columnZone, createCommand.seriesHasTitle));
                    }
                }
                else if (zone.left === zone.right && zone.top === zone.bottom) {
                    // A single cell. If it's only the title, the dataset is not added.
                    if (!createCommand.seriesHasTitle) {
                        dataSets.push({ dataRange: zoneToXc(zone) });
                    }
                }
                else {
                    dataSets.push(this.createDataset(zone, createCommand.seriesHasTitle));
                }
            }
            return {
                title: createCommand.title,
                type: createCommand.type,
                dataSets: dataSets,
                labelRange: createCommand.labelRange,
                sheetId: sheetId,
            };
        }
        /**
         * Create a chart dataset from a Zone.
         * The zone should be a single column or a single row
         */
        createDataset(zone, withTitle) {
            if (zone.left !== zone.right && zone.top !== zone.bottom) {
                throw new Error(`Zone should be a single column or row: ${zoneToXc(zone)}`);
            }
            const labelCell = withTitle ? toXC(zone.left, zone.top) : undefined;
            const offset = withTitle ? 1 : 0;
            const isColumn = zone.top !== zone.bottom && zone.left === zone.right;
            const dataRange = zoneToXc({
                top: isColumn ? zone.top + offset : zone.top,
                bottom: zone.bottom,
                left: isColumn ? zone.left : zone.left + offset,
                right: zone.right,
            });
            return { labelCell, dataRange };
        }
        getDefaultConfiguration(type, title, labels) {
            const config = {
                type,
                options: {
                    // https://www.chartjs.org/docs/latest/general/responsive.html
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: { padding: { left: 20, right: 20, top: 10, bottom: 10 } },
                    elements: {
                        line: {
                            fill: false, // do not fill the area under line charts
                        },
                        point: {
                            hitRadius: 15, // increased hit radius to display point tooltip when hovering nearby
                        },
                    },
                    animation: {
                        duration: 0, // general animation time
                    },
                    hover: {
                        animationDuration: 10, // duration of animations when hovering an item
                    },
                    responsiveAnimationDuration: 0,
                    title: {
                        display: true,
                        fontSize: 22,
                        fontStyle: "normal",
                        text: title,
                    },
                },
                data: {
                    labels,
                    datasets: [],
                },
            };
            if (type !== "pie") {
                config.options.scales = {
                    xAxes: [
                        {
                            ticks: {
                                // x axis configuration
                                maxRotation: 60,
                                minRotation: 15,
                                padding: 5,
                                labelOffset: 2,
                            },
                        },
                    ],
                    yAxes: [
                        {
                            ticks: {
                                // y axis configuration
                                beginAtZero: true, // the origin of the y axis is always zero
                            },
                        },
                    ],
                };
            }
            else {
                config.options.tooltips = {
                    callbacks: {
                        title: function (tooltipItems, data) {
                            return data.datasets[tooltipItems[0].datasetIndex].label;
                        },
                    },
                };
            }
            return config;
        }
        extractDataFromRange(sheetId, reference) {
            return reference ? this.getters.getRangeValues(reference, sheetId).flat(1) : [];
        }
        mapDefinitionToRuntime(definition) {
            const labels = definition.labelRange !== ""
                ? this.getters.getRangeFormattedValues(definition.labelRange, definition.sheetId).flat(1)
                : [];
            const runtime = this.getDefaultConfiguration(definition.type, definition.title, labels);
            let graphColorIndex = 0;
            const pieColors = [];
            if (definition.type === "pie") {
                const maxLength = Math.max(...definition.dataSets.map((ds) => this.extractDataFromRange(definition.sheetId, ds.dataRange).length));
                for (let i = 0; i <= maxLength; i++) {
                    pieColors.push(GraphColors[graphColorIndex]);
                    graphColorIndex = ++graphColorIndex % GraphColors.length;
                }
            }
            for (const [dsIndex, ds] of Object.entries(definition.dataSets)) {
                let label;
                if (ds.labelCell) {
                    try {
                        label = this.getters.evaluateFormula(ds.labelCell, definition.sheetId);
                    }
                    catch (e) {
                        // We want here to catch issue linked to async formula
                        label = `${chartTerms.Series} ${parseInt(dsIndex) + 1}`;
                    }
                }
                else {
                    label = `${chartTerms.Series} ${parseInt(dsIndex) + 1}`;
                }
                const dataset = {
                    label,
                    data: this.extractDataFromRange(definition.sheetId, ds.dataRange),
                    lineTension: 0,
                    borderColor: definition.type !== "pie" ? GraphColors[graphColorIndex] : "#FFFFFF",
                    backgroundColor: GraphColors[graphColorIndex],
                };
                if (definition.type === "pie") {
                    // In case of pie graph, dataset.backgroundColor is an array of string
                    // @ts-ignore
                    dataset.backgroundColor = pieColors;
                }
                graphColorIndex = ++graphColorIndex % GraphColors.length;
                runtime.data.datasets.push(dataset);
            }
            return runtime;
        }
        addChartFigure(sheetId, figure) {
            this.dispatch("CREATE_FIGURE", {
                sheet: sheetId,
                figure,
            });
            this.history.updateLocalState(["chartFigures"], new Set(this.chartFigures).add(figure.id));
            this.history.updateLocalState(["chartRuntime", figure.id], this.mapDefinitionToRuntime(figure.data));
        }
        isCellUsedInChart(chart, col, row) {
            if (isInside(col, row, toZone(chart.labelRange))) {
                return true;
            }
            for (let db of chart.dataSets) {
                if (db.dataRange && db.dataRange.length > 0 && isInside(col, row, toZone(db.dataRange))) {
                    return true;
                }
                if (db.labelCell && db.labelCell.length > 0 && isInside(col, row, toZone(db.labelCell))) {
                    return true;
                }
            }
            return false;
        }
    }
    ChartPlugin.getters = ["getChartRuntime"];
    ChartPlugin.layers = [3 /* Chart */];

    /**
     * Clipboard Plugin
     *
     * This clipboard manages all cut/copy/paste interactions internal to the
     * application, and with the OS clipboard as well.
     */
    class ClipboardPlugin extends BasePlugin {
        constructor() {
            super(...arguments);
            this.status = "empty";
            this.zones = [];
            this.originSheet = this.workbook.activeSheet.id;
            this._isPaintingFormat = false;
            this.pasteOnlyValue = false;
            this.pasteOnlyFormat = false;
        }
        // ---------------------------------------------------------------------------
        // Command Handling
        // ---------------------------------------------------------------------------
        allowDispatch(cmd) {
            if (cmd.type === "PASTE") {
                return this.isPasteAllowed(cmd.target);
            }
            return {
                status: "SUCCESS",
            };
        }
        handle(cmd) {
            switch (cmd.type) {
                case "COPY":
                    this.cutOrCopy(cmd.target, false);
                    break;
                case "CUT":
                    this.cutOrCopy(cmd.target, true);
                    break;
                case "PASTE":
                    this.pasteOnlyValue = "onlyValue" in cmd && !!cmd.onlyValue;
                    const onlyFormat = "onlyFormat" in cmd ? !!cmd.onlyFormat : this._isPaintingFormat;
                    this._isPaintingFormat = false;
                    this.pasteOnlyFormat = !this.pasteOnlyValue && onlyFormat;
                    if (cmd.interactive) {
                        this.interactivePaste(cmd.target);
                    }
                    else {
                        this.pasteFromModel(cmd.target);
                    }
                    break;
                case "PASTE_CELL":
                    this.pasteCell(cmd.origin, cmd.col, cmd.row, cmd.onlyValue, cmd.onlyFormat);
                    break;
                case "PASTE_FROM_OS_CLIPBOARD":
                    this.pasteFromClipboard(cmd.target, cmd.text);
                    break;
                case "ACTIVATE_PAINT_FORMAT":
                    this._isPaintingFormat = true;
                    this.cutOrCopy(cmd.target, false);
                    break;
            }
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        /**
         * Format the current clipboard to a string suitable for being pasted in other
         * programs.
         *
         * - add a tab character between each concecutive cells
         * - add a newline character between each line
         *
         * Note that it returns \t if the clipboard is empty. This is necessary for the
         * clipboard copy event to add it as data, otherwise an empty string is not
         * considered as a copy content.
         */
        getClipboardContent() {
            if (!this.cells) {
                return "\t";
            }
            return (this.cells
                .map((cells) => {
                return cells.map((c) => (c.cell ? this.getters.getCellText(c.cell) : "")).join("\t");
            })
                .join("\n") || "\t");
        }
        getPasteZones(target) {
            if (!this.cells) {
                return target;
            }
            const height = this.cells.length;
            const width = this.cells[0].length;
            const selection = target[target.length - 1];
            const pasteZones = [];
            let col = selection.left;
            let row = selection.top;
            const repX = Math.max(1, Math.floor((selection.right + 1 - selection.left) / width));
            const repY = Math.max(1, Math.floor((selection.bottom + 1 - selection.top) / height));
            for (let x = 1; x <= repX; x++) {
                for (let y = 1; y <= repY; y++) {
                    pasteZones.push({
                        left: col,
                        top: row,
                        right: col - 1 + x * width,
                        bottom: row - 1 + y * height,
                    });
                }
            }
            return pasteZones;
        }
        isPaintingFormat() {
            return this._isPaintingFormat;
        }
        // ---------------------------------------------------------------------------
        // Private methods
        // ---------------------------------------------------------------------------
        cutOrCopy(zones, cut) {
            const tops = new Set(zones.map((z) => z.top));
            const bottoms = new Set(zones.map((z) => z.bottom));
            const areZonesCompatible = tops.size === 1 && bottoms.size === 1;
            let clippedZones = areZonesCompatible ? zones : [zones[zones.length - 1]];
            clippedZones = clippedZones.map((z) => Object.assign({}, z));
            const cells = [];
            let { top, bottom } = clippedZones[0];
            for (let r = top; r <= bottom; r++) {
                const row = [];
                cells.push(row);
                for (let zone of clippedZones) {
                    let { left, right } = zone;
                    for (let c = left; c <= right; c++) {
                        const cell = this.getters.getCell(c, r);
                        row.push({
                            cell: cell ? Object.assign({}, cell) : null,
                            col: c,
                            row: r,
                        });
                    }
                }
            }
            this.status = "visible";
            this.shouldCut = cut;
            this.zones = clippedZones;
            this.cells = cells;
            this.originSheet = this.workbook.activeSheet.id;
        }
        pasteFromClipboard(target, content) {
            this.status = "invisible";
            const values = content
                .replace(/\r/g, "")
                .split("\n")
                .map((vals) => vals.split("\t"));
            const { left: activeCol, top: activeRow } = target[0];
            const width = Math.max.apply(Math, values.map((a) => a.length));
            const height = values.length;
            this.addMissingDimensions(width, height, activeCol, activeRow);
            for (let i = 0; i < values.length; i++) {
                for (let j = 0; j < values[i].length; j++) {
                    const xc = toXC(activeCol + j, activeRow + i);
                    this.dispatch("SET_VALUE", { xc, text: values[i][j] });
                }
            }
            this.dispatch("SET_SELECTION", {
                anchor: [activeCol, activeRow],
                zones: [
                    {
                        left: activeCol,
                        top: activeRow,
                        right: activeCol + width - 1,
                        bottom: activeRow + height - 1,
                    },
                ],
            });
        }
        isPasteAllowed(target) {
            const { zones, cells, status } = this;
            // cannot paste if we have a clipped zone larger than a cell and multiple
            // zones selected
            if (!zones || !cells || status === "empty") {
                return { status: "CANCELLED", reason: 12 /* EmptyClipboard */ };
            }
            else if (target.length > 1 && (cells.length > 1 || cells[0].length > 1)) {
                return { status: "CANCELLED", reason: 11 /* WrongPasteSelection */ };
            }
            return { status: "SUCCESS" };
        }
        pasteFromModel(target) {
            const { cells, shouldCut } = this;
            if (!cells) {
                return;
            }
            this.status = shouldCut ? "empty" : "invisible";
            if (shouldCut) {
                this.clearCutZone();
            }
            const height = cells.length;
            const width = cells[0].length;
            if (target.length > 1) {
                for (let zone of target) {
                    for (let i = zone.left; i <= zone.right; i++) {
                        for (let j = zone.top; j <= zone.bottom; j++) {
                            this.pasteZone(width, height, i, j);
                        }
                    }
                }
                return;
            }
            const selection = target[target.length - 1];
            let col = selection.left;
            let row = selection.top;
            const repX = Math.max(1, Math.floor((selection.right + 1 - selection.left) / width));
            const repY = Math.max(1, Math.floor((selection.bottom + 1 - selection.top) / height));
            for (let x = 0; x < repX; x++) {
                for (let y = 0; y < repY; y++) {
                    this.pasteZone(width, height, col + x * width, row + y * height);
                }
            }
            if (height > 1 || width > 1) {
                const newSelection = {
                    left: col,
                    top: row,
                    right: col + repX * width - 1,
                    bottom: row + repY * height - 1,
                };
                const [anchorCol, anchorRow] = this.getters.getSelection().anchor;
                const newCol = clip(anchorCol, col, col + repX * width - 1);
                const newRow = clip(anchorRow, row, row + repY * height - 1);
                this.dispatch("SET_SELECTION", {
                    anchor: [newCol, newRow],
                    zones: [newSelection],
                });
            }
        }
        clearCutZone() {
            for (let row of this.cells) {
                for (let cell of row) {
                    if (cell) {
                        this.dispatch("CLEAR_CELL", {
                            sheet: this.originSheet,
                            col: cell.col,
                            row: cell.row,
                        });
                    }
                }
            }
        }
        pasteZone(width, height, col, row) {
            // first, add missing cols/rows if needed
            this.addMissingDimensions(width, height, col, row);
            // then, perform the actual paste operation
            for (let r = 0; r < height; r++) {
                const rowCells = this.cells[r];
                for (let c = 0; c < width; c++) {
                    const originCell = rowCells[c];
                    this.dispatch("PASTE_CELL", {
                        origin: originCell.cell,
                        originCol: originCell.col,
                        originRow: originCell.row,
                        col: col + c,
                        row: row + r,
                        sheet: this.originSheet,
                        cut: this.shouldCut,
                        onlyValue: this.pasteOnlyValue,
                        onlyFormat: this.pasteOnlyFormat,
                    });
                }
            }
        }
        addMissingDimensions(width, height, col, row) {
            const { cols, rows } = this.workbook.activeSheet;
            const missingRows = height + row - rows.length;
            if (missingRows > 0) {
                this.dispatch("ADD_ROWS", {
                    row: rows.length - 1,
                    sheet: this.workbook.activeSheet.id,
                    quantity: missingRows,
                    position: "after",
                });
            }
            const missingCols = width + col - cols.length;
            if (missingCols > 0) {
                this.dispatch("ADD_COLUMNS", {
                    column: cols.length - 1,
                    sheet: this.workbook.activeSheet.id,
                    quantity: missingCols,
                    position: "after",
                });
            }
        }
        pasteCell(origin, col, row, onlyValue, onlyFormat) {
            const targetCell = this.getters.getCell(col, row);
            if (origin) {
                let style = origin.style;
                let border = origin.border;
                let format = origin.format;
                let content = origin.content || "";
                if (onlyValue) {
                    style = targetCell ? targetCell.style : undefined;
                    border = targetCell ? targetCell.border : undefined;
                    format = targetCell ? targetCell.format : undefined;
                    if (targetCell) {
                        if (targetCell.type === "date") {
                            format = targetCell.value.format;
                        }
                    }
                    if (origin.type === "formula" || origin.type === "date") {
                        content = this.valueToContent(origin.value);
                    }
                }
                else if (onlyFormat) {
                    content = targetCell ? targetCell.content : "";
                }
                else if (origin.type === "formula") {
                    const offsetX = col - origin.col;
                    const offsetY = row - origin.row;
                    content = this.getters.applyOffset(content, offsetX, offsetY);
                }
                let newCell = {
                    style: style,
                    border: border,
                    format: format,
                    sheet: this.workbook.activeSheet.id,
                    col: col,
                    row: row,
                    content: content,
                };
                this.dispatch("UPDATE_CELL", newCell);
            }
            if (!origin && targetCell) {
                if (onlyValue) {
                    if (targetCell.content) {
                        //this.history.updateCell(targetCell, "content", undefined);
                        this.history.updateCell(targetCell, "content", "");
                        this.history.updateCell(targetCell, "value", "");
                    }
                }
                else if (onlyFormat) {
                    if (targetCell.style) {
                        this.history.updateCell(targetCell, "style", undefined);
                    }
                    if (targetCell.border) {
                        this.history.updateCell(targetCell, "border", undefined);
                    }
                    if (targetCell.format) {
                        this.history.updateCell(targetCell, "format", undefined);
                    }
                }
                else {
                    this.dispatch("CLEAR_CELL", {
                        sheet: this.workbook.activeSheet.id,
                        col: col,
                        row: row,
                    });
                }
            }
        }
        valueToContent(cellValue) {
            switch (typeof cellValue) {
                case "number":
                    return cellValue.toString();
                case "string":
                    return cellValue;
                case "boolean":
                    return cellValue ? "TRUE" : "FALSE";
                case "object":
                    return cellValue.value.toString();
                default:
                    return "";
            }
        }
        interactivePaste(target) {
            const result = this.dispatch("PASTE", { target, onlyFormat: false });
            if (result.status === "CANCELLED") {
                if (result.reason === 11 /* WrongPasteSelection */) {
                    this.ui.notifyUser(_lt("This operation is not allowed with multiple selections."));
                }
                if (result.reason === 1 /* WillRemoveExistingMerge */) {
                    this.ui.askConfirmation(_lt("Pasting here will remove existing merge(s). Paste anyway?"), () => this.dispatch("PASTE", { target, onlyFormat: false, force: true }));
                }
            }
        }
        // ---------------------------------------------------------------------------
        // Grid rendering
        // ---------------------------------------------------------------------------
        drawGrid(renderingContext) {
            const { viewport, ctx, thinLineWidth } = renderingContext;
            const zones = this.zones;
            if (this.status !== "visible" ||
                !zones.length ||
                this.originSheet !== this.getters.getActiveSheet()) {
                return;
            }
            ctx.save();
            ctx.setLineDash([8, 5]);
            ctx.strokeStyle = "#3266ca";
            ctx.lineWidth = 3.3 * thinLineWidth;
            for (const zone of zones) {
                const [x, y, width, height] = this.getters.getRect(zone, viewport);
                if (width > 0 && height > 0) {
                    ctx.strokeRect(x, y, width, height);
                }
            }
            ctx.restore();
        }
    }
    ClipboardPlugin.layers = [2 /* Clipboard */];
    ClipboardPlugin.getters = ["getClipboardContent", "isPaintingFormat", "getPasteZones"];
    ClipboardPlugin.modes = ["normal", "readonly"];

    // -----------------------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------------------
    class ConditionalFormatPlugin extends BasePlugin {
        constructor() {
            super(...arguments);
            this.isStale = true;
            this.cfRules = {};
            // stores the computed styles in the format of computedStyles.sheetName.cellXC = Style
            this.computedStyles = {};
            /**
             * Execute the predicate to know if a conditional formatting rule should be applied to a cell
             */
            this.rulePredicate = {
                CellIsRule: (cell, rule) => {
                    switch (rule.operator) {
                        case "BeginsWith":
                            if (!cell && rule.values[0] === "") {
                                return false;
                            }
                            return cell && cell.value.startsWith(rule.values[0]);
                        case "EndsWith":
                            if (!cell && rule.values[0] === "") {
                                return false;
                            }
                            return cell && cell.value.endsWith(rule.values[0]);
                        case "Between":
                            return cell && cell.value >= rule.values[0] && cell.value <= rule.values[1];
                        case "NotBetween":
                            return !(cell && cell.value >= rule.values[0] && cell.value <= rule.values[1]);
                        case "ContainsText":
                            return cell && cell.value && cell.value.toString().indexOf(rule.values[0]) > -1;
                        case "NotContains":
                            return cell && cell.value && cell.value.toString().indexOf(rule.values[0]) == -1;
                        case "GreaterThan":
                            return cell && cell.value > rule.values[0];
                        case "GreaterThanOrEqual":
                            return cell && cell.value >= rule.values[0];
                        case "LessThan":
                            return cell && cell.value < rule.values[0];
                        case "LessThanOrEqual":
                            return cell && cell.value <= rule.values[0];
                        case "NotEqual":
                            if (!cell && rule.values[0] === "") {
                                return false;
                            }
                            return cell && cell.value != rule.values[0];
                        case "Equal":
                            if (!cell && rule.values[0] === "") {
                                return true;
                            }
                            return cell && cell.value == rule.values[0];
                        default:
                            console.warn(_lt("Not implemented operator %s for kind of conditional formatting:  %s", rule.operator, rule.type));
                    }
                    return false;
                },
            };
        }
        // ---------------------------------------------------------------------------
        // Command Handling
        // ---------------------------------------------------------------------------
        handle(cmd) {
            switch (cmd.type) {
                case "ACTIVATE_SHEET":
                    const activeSheet = cmd.to;
                    this.computedStyles[activeSheet] = this.computedStyles[activeSheet] || {};
                    this.isStale = true;
                    break;
                case "CREATE_SHEET":
                    this.cfRules[cmd.id] = [];
                    this.isStale = true;
                    break;
                case "DUPLICATE_SHEET":
                    this.history.updateLocalState(["cfRules", cmd.id], this.cfRules[cmd.sheet].slice());
                    this.isStale = true;
                    break;
                case "DELETE_SHEET":
                    const cfRules = Object.assign({}, this.cfRules);
                    delete cfRules[cmd.sheet];
                    this.history.updateLocalState(["cfRules"], cfRules);
                    this.isStale = true;
                    break;
                case "ADD_CONDITIONAL_FORMAT":
                    this.addConditionalFormatting(cmd.cf, cmd.sheet);
                    this.isStale = true;
                    break;
                case "REMOVE_CONDITIONAL_FORMAT":
                    this.removeConditionalFormatting(cmd.id, cmd.sheet);
                    this.isStale = true;
                    break;
                case "REMOVE_COLUMNS":
                    this.adaptcfRules(cmd.sheet, (range) => updateRemoveColumns(range, cmd.columns));
                    this.isStale = true;
                    break;
                case "REMOVE_ROWS":
                    this.adaptcfRules(cmd.sheet, (range) => updateRemoveRows(range, cmd.rows));
                    this.isStale = true;
                    break;
                case "ADD_COLUMNS":
                    const column = cmd.position === "before" ? cmd.column : cmd.column + 1;
                    this.adaptcfRules(cmd.sheet, (range) => updateAddColumns(range, column, cmd.quantity));
                    this.isStale = true;
                    break;
                case "AUTOFILL_CELL":
                    const sheet = this.getters.getActiveSheet();
                    const cfOrigin = this.getRulesByCell(toXC(cmd.originCol, cmd.originRow));
                    for (const cf of cfOrigin) {
                        this.adaptRules(sheet, cf, [toXC(cmd.col, cmd.row)], []);
                    }
                    break;
                case "ADD_ROWS":
                    const row = cmd.position === "before" ? cmd.row : cmd.row + 1;
                    this.adaptcfRules(cmd.sheet, (range) => updateAddRows(range, row, cmd.quantity));
                    this.isStale = true;
                    break;
                case "PASTE_CELL":
                    if (!cmd.onlyValue) {
                        this.pasteCf(cmd.originCol, cmd.originRow, cmd.col, cmd.row, cmd.sheet, cmd.cut);
                    }
                    break;
                case "EVALUATE_CELLS":
                case "UPDATE_CELL":
                case "UNDO":
                case "REDO":
                    this.isStale = true;
                    break;
            }
        }
        finalize() {
            if (this.isStale && this.currentMode !== "headless") {
                this.computeStyles();
                this.isStale = false;
            }
        }
        import(data) {
            for (let sheet of data.sheets) {
                this.cfRules[sheet.id] = sheet.conditionalFormats;
            }
        }
        export(data) {
            if (data.sheets) {
                for (let sheet of data.sheets) {
                    if (this.cfRules[sheet.id]) {
                        sheet.conditionalFormats = this.cfRules[sheet.id];
                    }
                }
            }
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        /**
         * Returns all the conditional format rules defined for the current sheet
         */
        getConditionalFormats() {
            return this.cfRules[this.workbook.activeSheet.id];
        }
        /**
         * Returns the conditional style property for a given cell reference in the active sheet or
         * undefined if this cell doesn't have a conditional style set.
         */
        getConditionalStyle(xc) {
            return (this.computedStyles[this.workbook.activeSheet.id] &&
                this.computedStyles[this.workbook.activeSheet.id][xc]);
        }
        getRulesSelection(selection) {
            const ruleIds = new Set();
            selection.forEach((zone) => {
                const zoneRuleId = this.getRulesByZone(zone);
                zoneRuleId.forEach((ruleId) => {
                    ruleIds.add(ruleId);
                });
            });
            return Array.from(ruleIds);
        }
        getRulesByZone(zone) {
            const ruleIds = new Set();
            for (let row = zone.top; row <= zone.bottom; row++) {
                for (let col = zone.left; col <= zone.right; col++) {
                    const cellRules = this.getRulesByCell(toXC(col, row));
                    cellRules.forEach((rule) => {
                        ruleIds.add(rule.id);
                    });
                }
            }
            return ruleIds;
        }
        getRulesByCell(cellXc) {
            const currentSheet = this.workbook.activeSheet.id;
            const rulesId = new Set();
            for (let cf of this.cfRules[currentSheet]) {
                for (let ref of cf.ranges) {
                    const zone = toZone(ref);
                    for (let row = zone.top; row <= zone.bottom; row++) {
                        for (let col = zone.left; col <= zone.right; col++) {
                            let xc = toXC(col, row);
                            if (cellXc == xc) {
                                rulesId.add(cf);
                            }
                        }
                    }
                }
            }
            return rulesId;
        }
        // ---------------------------------------------------------------------------
        // Private
        // ---------------------------------------------------------------------------
        /**
         * Add or replace a conditional format rule
         */
        addConditionalFormatting(cf, sheet) {
            const currentCF = this.cfRules[sheet].slice();
            const replaceIndex = currentCF.findIndex((c) => c.id === cf.id);
            if (replaceIndex > -1) {
                currentCF.splice(replaceIndex, 1, cf);
            }
            else {
                currentCF.push(cf);
            }
            this.history.updateLocalState(["cfRules", sheet], currentCF);
        }
        /**
         * Execute the complete color scale for the range of the conditional format for a 2 colors rule
         */
        applyColorScale(range, rule) {
            const minValue = Number(this.getters.evaluateFormula(`=min(${range})`));
            const maxValue = Number(this.getters.evaluateFormula(`=max(${range})`));
            if (Number.isNaN(minValue) || Number.isNaN(maxValue)) {
                return;
            }
            const deltaValue = maxValue - minValue;
            if (!deltaValue) {
                return;
            }
            const deltaColorR = ((rule.minimum.color >> 16) % 256) - ((rule.maximum.color >> 16) % 256);
            const deltaColorG = ((rule.minimum.color >> 8) % 256) - ((rule.maximum.color >> 8) % 256);
            const deltaColorB = (rule.minimum.color % 256) - (rule.maximum.color % 256);
            const colorDiffUnitR = deltaColorR / deltaValue;
            const colorDiffUnitG = deltaColorG / deltaValue;
            const colorDiffUnitB = deltaColorB / deltaValue;
            const zone = toZone(range);
            for (let row = zone.top; row <= zone.bottom; row++) {
                for (let col = zone.left; col <= zone.right; col++) {
                    const cell = this.getters.getCell(col, row);
                    if (cell && !Number.isNaN(Number.parseFloat(cell.value))) {
                        const r = Math.round(((rule.minimum.color >> 16) % 256) - colorDiffUnitR * (cell.value - minValue));
                        const g = Math.round(((rule.minimum.color >> 8) % 256) - colorDiffUnitG * (cell.value - minValue));
                        const b = Math.round((rule.minimum.color % 256) - colorDiffUnitB * (cell.value - minValue));
                        const color = (r << 16) | (g << 8) | b;
                        this.computedStyles[this.workbook.activeSheet.id][cell.xc] =
                            this.computedStyles[this.workbook.activeSheet.id][cell.xc] || {};
                        this.computedStyles[this.workbook.activeSheet.id][cell.xc].fillColor =
                            "#" + colorNumberString(color);
                    }
                }
            }
        }
        /**
         * Compute the styles according to the conditional formatting.
         * This computation must happen after the cell values are computed if they change
         *
         * This result of the computation will be in the state.cell[XC].conditionalStyle and will be the union of all the style
         * properties of the rules applied (in order).
         * So if a cell has multiple conditional formatting applied to it, and each affect a different value of the style,
         * the resulting style will have the combination of all those values.
         * If multiple conditional formatting use the same style value, they will be applied in order so that the last applied wins
         */
        computeStyles() {
            const currentSheet = this.workbook.activeSheet.id;
            this.computedStyles[currentSheet] = {};
            for (let cf of this.cfRules[currentSheet]) {
                try {
                    switch (cf.rule.type) {
                        case "ColorScaleRule":
                            for (let range of cf.ranges) {
                                this.applyColorScale(range, cf.rule);
                            }
                            break;
                        default:
                            for (let ref of cf.ranges) {
                                const zone = toZone(ref);
                                for (let row = zone.top; row <= zone.bottom; row++) {
                                    for (let col = zone.left; col <= zone.right; col++) {
                                        const pr = this.rulePredicate[cf.rule.type];
                                        let cell = this.workbook.activeSheet.rows[row].cells[col];
                                        let xc = toXC(col, row);
                                        if (pr && pr(cell, cf.rule)) {
                                            // we must combine all the properties of all the CF rules applied to the given cell
                                            this.computedStyles[currentSheet][xc] = Object.assign(this.computedStyles[currentSheet][xc] || {}, cf.rule.style);
                                        }
                                    }
                                }
                            }
                            break;
                    }
                }
                catch (_) {
                    // we don't care about the errors within the evaluation of a rule
                }
            }
        }
        adaptcfRules(sheet, updateCb) {
            const currentCfs = this.cfRules[sheet];
            const newCfs = [];
            for (let cf of currentCfs) {
                const updatedRanges = [];
                for (let range of cf.ranges) {
                    const updatedRange = updateCb(range);
                    if (updatedRange) {
                        updatedRanges.push(updatedRange);
                    }
                }
                if (updatedRanges.length === 0) {
                    continue;
                }
                newCfs.push({ ...cf, ranges: updatedRanges });
            }
            this.history.updateLocalState(["cfRules", sheet], newCfs);
        }
        removeConditionalFormatting(id, sheet) {
            const cfIndex = this.cfRules[sheet].findIndex((s) => s.id === id);
            if (cfIndex !== -1) {
                const currentCF = this.cfRules[sheet].slice();
                currentCF.splice(cfIndex, 1);
                this.history.updateLocalState(["cfRules", sheet], currentCF);
            }
        }
        // ---------------------------------------------------------------------------
        // Copy/Cut/Paste and Merge
        // ---------------------------------------------------------------------------
        pasteCf(originCol, originRow, col, row, originSheet, cut) {
            const xc = toXC(col, row);
            for (let rule of this.cfRules[originSheet]) {
                for (let range of rule.ranges) {
                    if (isInside(originCol, originRow, toZone(range))) {
                        const cf = rule;
                        const toRemoveRange = [];
                        if (cut) {
                            //remove from current rule
                            toRemoveRange.push(toXC(originCol, originRow));
                        }
                        if (originSheet === this.workbook.activeSheet.id) {
                            this.adaptRules(originSheet, cf, [xc], toRemoveRange);
                        }
                        else {
                            this.adaptRules(this.workbook.activeSheet.id, cf, [xc], []);
                            this.adaptRules(originSheet, cf, [], toRemoveRange);
                        }
                    }
                }
            }
        }
        adaptRules(sheet, cf, toAdd, toRemove) {
            if (toAdd.length === 0 && toRemove.length === 0) {
                return;
            }
            const replaceIndex = this.cfRules[sheet].findIndex((c) => c.id === cf.id);
            let currentRanges = [];
            if (replaceIndex > -1) {
                currentRanges = this.cfRules[sheet][replaceIndex].ranges;
            }
            currentRanges = currentRanges.concat(toAdd);
            const newRange = recomputeZones(currentRanges, toRemove);
            this.addConditionalFormatting({
                id: cf.id,
                rule: cf.rule,
                stopIfTrue: cf.stopIfTrue,
                ranges: newRange,
            }, sheet);
        }
    }
    ConditionalFormatPlugin.getters = ["getConditionalFormats", "getConditionalStyle", "getRulesSelection"];

    const functions$1 = functionRegistry.content;
    const OPERATOR_MAP = {
        "=": "EQ",
        "+": "ADD",
        "-": "MINUS",
        "*": "MULTIPLY",
        "/": "DIVIDE",
        ">=": "GTE",
        "<>": "NE",
        ">": "GT",
        "<=": "LTE",
        "<": "LT",
        "^": "POWER",
        "&": "CONCATENATE",
    };
    const UNARY_OPERATOR_MAP = {
        "-": "UMINUS",
        "+": "UPLUS",
    };
    // this cache contains all compiled function code, grouped by "structure". For
    // example, "=2*sum(A1:A4)" and "=2*sum(B1:B4)" are compiled into the same
    // structural function.
    //
    // It is only exported for testing purposes
    const functionCache = {};
    // -----------------------------------------------------------------------------
    // COMPILER
    // -----------------------------------------------------------------------------
    const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
    function compile(str) {
        // TODO: rename that 'str' variable. Doesn't make sense
        let isAsync = false;
        if (!functionCache[str.text]) {
            const ast = parse(str.text);
            let nextId = 1;
            const code = [`// ${str.text}`];
            if (ast.type === "BIN_OPERATION" && ast.value === ":") {
                throw new Error(_lt("Invalid formula"));
            }
            if (ast.type === "UNKNOWN") {
                throw new Error(_lt("Invalid formula"));
            }
            /**
             * This function compile the function arguments. It is mostly straightforward,
             * except that there is a non trivial transformation in one situation:
             *
             * If a function argument is asking for a range, and get a cell, we transform
             * the cell value into a range. This allow the grid model to differentiate
             * between a cell value and a non cell value.
             */
            function compileFunctionArgs(ast) {
                const functionDefinition = functions$1[ast.value.toUpperCase()];
                let argDefinition;
                const result = [];
                const currentFunctionArguments = ast.args;
                const isRepeating = functionDefinition.args.length
                    ? functionDefinition.args[functionDefinition.args.length - 1].repeating
                    : false;
                let minArg = 0;
                let maxArg = isRepeating ? Infinity : functionDefinition.args.length;
                for (let arg of functionDefinition.args) {
                    if (!arg.optional) {
                        minArg++;
                    }
                }
                if (currentFunctionArguments.length < minArg || currentFunctionArguments.length > maxArg) {
                    throw new Error(_lt("Invalid number of arguments for the %s function. Expected %s, but got %s instead.", ast.value.toUpperCase(), functionDefinition.args.length.toString(), currentFunctionArguments.length.toString()));
                }
                for (let i = 0; i < currentFunctionArguments.length; i++) {
                    const arg = currentFunctionArguments[i];
                    argDefinition = functionDefinition.args[i] || argDefinition;
                    const isLazy = argDefinition && argDefinition.lazy;
                    const types = (argDefinition && argDefinition.type) || [];
                    const hasRange = types.some((t) => t === "RANGE" ||
                        t === "RANGE<BOOLEAN>" ||
                        t === "RANGE<DATE>" ||
                        t === "RANGE<NUMBER>" ||
                        t === "RANGE<STRING>");
                    const isRangeOnly = types.every((t) => t === "RANGE" ||
                        t === "RANGE<BOOLEAN>" ||
                        t === "RANGE<DATE>" ||
                        t === "RANGE<NUMBER>" ||
                        t === "RANGE<STRING>");
                    if (isRangeOnly && arg.type !== "REFERENCE") {
                        throw new Error(_lt("Function %s expects the parameter %s to be reference to a cell or range, not a %s.", ast.value.toUpperCase(), (i + 1).toString(), arg.type.toLowerCase().replace("normalized_", "")));
                    }
                    if (
                    // a range of more than 1 cell
                    arg.type === "BIN_OPERATION" &&
                        arg.value === ":" &&
                        arg.left.value !== arg.right.value &&
                        !hasRange) {
                        throw new Error(_lt("Function %s expects the parameter %s to be a single value or a single cell reference, not a range.", ast.value.toUpperCase(), (i + 1).toString()));
                    }
                    let argValue = compileAST(arg, isLazy, hasRange, {
                        functionName: ast.value.toUpperCase(),
                        paramIndex: i + 1,
                    });
                    result.push(argValue);
                }
                return result;
            }
            /**
             * This function compiles all the information extracted by the parser into an
             * executable code for the evaluation of the cells content. It uses a cache to
             * not reevaluate identical code structures.
             *
             * The function is sensitive to parameter “isLazy”. It may vary when compiling
             * function arguments:
             *
             * - isLazy: In some cases the function arguments does not need to be
             * evaluated before entering the functions. For example the IF function might
             * take invalid arguments that do not need to be evaluate and thus should not
             * create an error. For this we have lazy arguments.
             *
             */
            function compileAST(ast, isLazy = false, hasRange = false, referenceVerification = {}) {
                let id, left, right, args, fnName, statement;
                if (ast.debug) {
                    code.push("debugger;");
                }
                switch (ast.type) {
                    case "BOOLEAN":
                    case "NUMBER": // probably dead case
                    case "STRING": // probably dead case
                        id = nextId++;
                        statement = ast.value;
                        break;
                    case "NORMALIZED_NUMBER":
                    case "NORMALIZED_STRING":
                        id = nextId++;
                        statement = `deps[${ast.value}]`;
                        break;
                    case "REFERENCE":
                        const referenceText = str.dependencies[ast.value];
                        if (!referenceText) {
                            id = nextId++;
                            statement = `null`;
                            break;
                        }
                        id = nextId++;
                        if (hasRange) {
                            statement = `range(${ast.value}, deps, sheetId)`;
                        }
                        else {
                            statement = `ref(${ast.value}, deps, sheetId,
              "${referenceVerification.functionName}", ${referenceVerification.paramIndex})`;
                        }
                        break;
                    case "FUNCALL":
                        id = nextId++;
                        args = compileFunctionArgs(ast);
                        fnName = ast.value.toUpperCase();
                        code.push(`ctx.__lastFnCalled = '${fnName}'`);
                        statement = `ctx['${fnName}'](${args})`;
                        break;
                    case "ASYNC_FUNCALL":
                        id = nextId++;
                        isAsync = true;
                        args = compileFunctionArgs(ast);
                        fnName = ast.value.toUpperCase();
                        code.push(`ctx.__lastFnCalled = '${fnName}'`);
                        statement = `await ctx['${fnName}'](${args})`;
                        break;
                    case "UNARY_OPERATION":
                        id = nextId++;
                        right = compileAST(ast.right);
                        fnName = UNARY_OPERATOR_MAP[ast.value];
                        code.push(`ctx.__lastFnCalled = '${fnName}'`);
                        statement = `ctx['${fnName}']( ${right})`;
                        break;
                    case "BIN_OPERATION":
                        id = nextId++;
                        left = compileAST(ast.left);
                        right = compileAST(ast.right);
                        fnName = OPERATOR_MAP[ast.value];
                        code.push(`ctx.__lastFnCalled = '${fnName}'`);
                        statement = `ctx['${fnName}'](${left}, ${right})`;
                        break;
                    case "UNKNOWN":
                        if (!isLazy) {
                            return "null";
                        }
                        id = nextId++;
                        statement = `null`;
                        break;
                }
                code.push(`let _${id} = ` + (isLazy ? `()=> ` : ``) + statement);
                return `_${id}`;
            }
            code.push(`return ${compileAST(ast)};`);
            const Constructor = isAsync ? AsyncFunction : Function;
            let baseFunction = new Constructor("deps", // the dependencies in the current formula
            "sheetId", // the sheet the formula is currently evaluating
            "ref", // a function to access a certain dependency at a given index
            "range", // same as above, but guarantee that the result is in the form of a range
            "ctx", code.join("\n"));
            functionCache[str.text] = baseFunction;
            functionCache[str.text].async = isAsync;
        }
        return functionCache[str.text];
    }

    /**
     * finds a sequence of token that represent a range and replace them with a single token
     * The range can be
     *  ?spaces symbol ?spaces operator: ?spaces symbol ?spaces
     */
    function mergeSymbolsIntoRanges(result, removeSpace = false) {
        let operator = undefined;
        let refStart = undefined;
        let refEnd = undefined;
        let startIncludingSpaces = undefined;
        const reset = () => {
            startIncludingSpaces = undefined;
            refStart = undefined;
            operator = undefined;
            refEnd = undefined;
        };
        for (let i = 0; i < result.length; i++) {
            const token = result[i];
            if (startIncludingSpaces) {
                if (refStart) {
                    if (token.type === "SPACE") {
                        continue;
                    }
                    else if (token.type === "OPERATOR" && token.value === ":") {
                        operator = i;
                    }
                    else if (operator && token.type === "SYMBOL") {
                        refEnd = i;
                    }
                    else {
                        if (startIncludingSpaces && refStart && operator && refEnd) {
                            const newToken = {
                                type: "SYMBOL",
                                value: result
                                    .slice(startIncludingSpaces, i)
                                    .filter((x) => !removeSpace || x.type !== "SPACE")
                                    .map((x) => x.value)
                                    .join(""),
                            };
                            result.splice(startIncludingSpaces, i - startIncludingSpaces, newToken);
                            i = startIncludingSpaces + 1;
                            reset();
                        }
                        else {
                            if (token.type === "SYMBOL") {
                                startIncludingSpaces = i;
                                refStart = i;
                                operator = undefined;
                            }
                            else {
                                reset();
                            }
                        }
                    }
                }
                else {
                    if (token.type === "SYMBOL") {
                        refStart = i;
                        operator = refEnd = undefined;
                    }
                    else {
                        reset();
                    }
                }
            }
            else {
                if (["SPACE", "SYMBOL"].includes(token.type)) {
                    startIncludingSpaces = i;
                    refStart = token.type === "SYMBOL" ? i : undefined;
                    operator = refEnd = undefined;
                }
                else {
                    reset();
                }
            }
        }
        const i = result.length - 1;
        if (startIncludingSpaces && refStart && operator && refEnd) {
            const newToken = {
                type: "SYMBOL",
                value: result
                    .slice(startIncludingSpaces, i + 1)
                    .filter((x) => !removeSpace || x.type !== "SPACE")
                    .map((x) => x.value)
                    .join(""),
            };
            result.splice(startIncludingSpaces, i - startIncludingSpaces + 1, newToken);
        }
        return result;
    }
    /**
     * Take the result of the tokenizer and transform it to be usable in the
     * manipulations of range
     *
     * @param formula
     */
    function rangeTokenize(formula) {
        const tokens = tokenize(formula);
        return mergeSymbolsIntoRanges(tokens, true);
    }

    /**
     * Add the following information on tokens:
     * - length
     * - start
     * - end
     */
    function enrichTokens(tokens) {
        let current = 0;
        return tokens.map((x) => {
            const len = x.value.toString().length;
            const token = Object.assign({}, x, {
                start: current,
                end: current + len,
                length: len,
            });
            current = token.end;
            return token;
        });
    }
    /**
     * add on each token the length, start and end
     * also matches the opening to its closing parenthesis (using the same number)
     */
    function mapParenthesis(tokens) {
        let maxParen = 1;
        const stack = [];
        return tokens.map((token) => {
            if (token.type === "LEFT_PAREN") {
                stack.push(maxParen);
                token.parenIndex = maxParen;
                maxParen++;
            }
            else if (token.type === "RIGHT_PAREN") {
                token.parenIndex = stack.pop();
            }
            return token;
        });
    }
    /**
     * Take the result of the tokenizer and transform it to be usable in the composer.
     *
     * @param formula
     */
    function composerTokenize(formula) {
        const tokens = tokenize(formula);
        return mapParenthesis(enrichTokens(mergeSymbolsIntoRanges(tokens)));
    }

    /**
     * parses a formula (as a string) into the same formula,
     * but with the references to other cells as well as strings and numbers extracted
     *
     * =sum(a3:b1) + c3 --> =sum(|0|) + |1|
     *
     * = sum(a3, 5) --> =sum(|0|, |N1|)
     *
     * =CONCAT(CONCAT(1, "beta"), A1) --> =CONCAT(CONCAT(|N0|, |S1|), |2|)
     *
     * Strings and Numbers are marked with a prefix of their type (S and N) to be detected
     * as their normalized form by the parser as they won't be processed like the references by the compiler.
     *
     * @param formula
     */
    function normalize(formula) {
        const tokens = rangeTokenize(formula);
        let references = [];
        let noRefFormula = "".concat(...tokens.map((token) => {
            if (token.type === "SYMBOL" && cellReference.test(token.value)) {
                const value = token.value.trim();
                if (!references.includes(value)) {
                    references.push(value);
                }
                return `${FORMULA_REF_IDENTIFIER}${references.indexOf(value)}${FORMULA_REF_IDENTIFIER}`;
            }
            else if (["STRING", "NUMBER"].includes(token.type)) {
                const value = token.type === "STRING"
                    ? token.value.slice(1).slice(0, token.value.length - 2)
                    : parseNumber(token.value);
                if (!references.includes(value)) {
                    references.push(value);
                }
                return `${FORMULA_REF_IDENTIFIER}${token.type[0]}${references.indexOf(value)}${FORMULA_REF_IDENTIFIER}`;
            }
            else {
                return token.value;
            }
        }));
        return { text: noRefFormula, dependencies: references };
    }

    const nbspRegexp = new RegExp(String.fromCharCode(160), "g");
    const MIN_PADDING = 3;
    /**
     * Core Plugin
     *
     * This is the most fundamental of all plugins. It defines how to interact with
     * cell and sheet content.
     */
    class CorePlugin extends BasePlugin {
        constructor() {
            super(...arguments);
            this.sheetIds = {};
            this.showFormulas = false;
            // ---------------------------------------------------------------------------
            // Cols/Rows addition/deletion offsets manipulation
            // ---------------------------------------------------------------------------
            /**
             * Update a reference by applying an offset to the column
             *
             * @param ref Reference to update
             * @param sheet Id of the sheet, if cross-sheet reference
             * @param base Index of the element added/removed
             * @param step Number of elements added or -1 if removed
             */
            this.updateColumnsRef = (ref, sheet, base, step) => {
                let x = toCartesian(ref)[0];
                if (x === base && step === -1) {
                    return "#REF";
                }
                return this.updateReference(ref, x > base ? step : 0, 0, this.getSheetIdByName(sheet), false);
            };
            /**
             * Update a full range by appling an offset.
             *
             * @param ref Reference to update
             * @param sheet Id of the sheet, if cross-sheet reference
             * @param base Index of the element added/removed
             * @param step Number of elements added or -1 if removed
             */
            this.updateColumnsRange = (ref, sheet, base, step) => {
                const currentZone = toZone(ref);
                const recomputedRefs = step < 0
                    ? recomputeZones([ref], [this.zoneToXC({ ...currentZone, left: base + step + 1, right: base })])
                    : [ref];
                if (recomputedRefs.length === 0) {
                    return "#REF";
                }
                const leftZone = toZone(recomputedRefs[0]);
                const rightZone = step < 0 && currentZone.left < base + step + 1 && base < currentZone.right
                    ? toZone(recomputedRefs[1])
                    : leftZone;
                const left = base < leftZone.left ? leftZone.left + step : leftZone.left;
                const right = base < rightZone.right ? rightZone.right + step : rightZone.right;
                const [leftXc, rightXc] = ref.split(":");
                const sheetId = this.getters.getSheetIdByName(sheet);
                const newLeft = this.updateReference(leftXc, left - currentZone.left, 0, sheetId, false, false);
                const newRight = this.updateReference(rightXc, right - currentZone.right, 0, sheetId, false, false);
                if (newLeft === newRight) {
                    return newLeft;
                }
                //As updateReference put the sheet in the ref, we need to remove it from the right part
                return `${newLeft}:${newRight.split("!").pop()}`;
            };
            /**
             * Update a reference by applying an offset to the row
             *
             * @param ref Reference to update
             * @param sheet Id of the sheet, if cross-sheet reference
             * @param base Index of the element added/removed
             * @param step Number of elements added or -1 if removed
             */
            this.updateRowsRef = (ref, sheet, base, step) => {
                let y = toCartesian(ref)[1];
                if (base + step < y && y <= base) {
                    return "#REF";
                }
                return this.updateReference(ref, 0, y > base ? step : 0, this.getSheetIdByName(sheet), false);
            };
            /**
             * Update a full range by appling an offset.
             *
             * @param ref Reference to update
             * @param sheet Id of the sheet, if cross-sheet reference
             * @param base Index of the element added/removed
             * @param step Number of elements added/removed (negative when removed)
             */
            this.updateRowsRange = (ref, sheet, base, step) => {
                const currentZone = toZone(ref);
                // base+step+1 === left element of the zone to remove
                const recomputedRefs = step < 0
                    ? recomputeZones([ref], [this.zoneToXC({ ...currentZone, top: base + step + 1, bottom: base })])
                    : [ref];
                if (recomputedRefs.length === 0) {
                    return "#REF";
                }
                const topZone = toZone(recomputedRefs[0]);
                // base+step+1 === top element of the zone to remove
                const bottomZone = step < 0 && currentZone.top < base + step + 1 && base < currentZone.bottom
                    ? toZone(recomputedRefs[1])
                    : topZone;
                const top = base < topZone.top ? topZone.top + step : topZone.top;
                const bottom = base < bottomZone.bottom ? bottomZone.bottom + step : bottomZone.bottom;
                const [left, right] = ref.split(":");
                const sheetId = this.getters.getSheetIdByName(sheet);
                const newLeft = this.updateReference(left, 0, top - currentZone.top, sheetId, false, false);
                const newRight = this.updateReference(right, 0, bottom - currentZone.bottom, sheetId, false, false);
                if (newLeft === newRight) {
                    return newLeft;
                }
                //As updateReference put the sheet in the ref, we need to remove it from the right part
                return `${newLeft}:${newRight.split("!").pop()}`;
            };
        }
        // ---------------------------------------------------------------------------
        // Command Handling
        // ---------------------------------------------------------------------------
        allowDispatch(cmd) {
            switch (cmd.type) {
                case "REMOVE_COLUMNS":
                    return this.workbook.sheets[cmd.sheet].cols.length > cmd.columns.length
                        ? { status: "SUCCESS" }
                        : { status: "CANCELLED", reason: 5 /* NotEnoughColumns */ };
                case "REMOVE_ROWS":
                    return this.workbook.sheets[cmd.sheet].rows.length > cmd.rows.length
                        ? { status: "SUCCESS" }
                        : { status: "CANCELLED", reason: 6 /* NotEnoughRows */ };
                case "CREATE_SHEET":
                case "DUPLICATE_SHEET":
                    const { visibleSheets, sheets } = this.workbook;
                    return !cmd.name || !visibleSheets.find((id) => sheets[id].name === cmd.name)
                        ? { status: "SUCCESS" }
                        : { status: "CANCELLED", reason: 8 /* WrongSheetName */ };
                case "MOVE_SHEET":
                    const currentIndex = this.workbook.visibleSheets.findIndex((id) => id === cmd.sheet);
                    if (currentIndex === -1) {
                        return { status: "CANCELLED", reason: 8 /* WrongSheetName */ };
                    }
                    return (cmd.direction === "left" && currentIndex === 0) ||
                        (cmd.direction === "right" && currentIndex === this.workbook.visibleSheets.length - 1)
                        ? { status: "CANCELLED", reason: 9 /* WrongSheetMove */ }
                        : { status: "SUCCESS" };
                case "RENAME_SHEET":
                    return this.isRenameAllowed(cmd);
                case "DELETE_SHEET_CONFIRMATION":
                case "DELETE_SHEET":
                    return this.workbook.visibleSheets.length > 1
                        ? { status: "SUCCESS" }
                        : { status: "CANCELLED", reason: 7 /* NotEnoughSheets */ };
                default:
                    return { status: "SUCCESS" };
            }
        }
        handle(cmd) {
            switch (cmd.type) {
                case "ACTIVATE_SHEET":
                    this.history.updateState(["activeSheet"], this.workbook.sheets[cmd.to]);
                    break;
                case "CREATE_SHEET":
                    const sheet = this.createSheet(cmd.id, cmd.name || this.generateSheetName(), cmd.cols || 26, cmd.rows || 100);
                    this.sheetIds[this.workbook.sheets[sheet].name] = sheet;
                    if (cmd.activate) {
                        this.dispatch("ACTIVATE_SHEET", { from: this.workbook.activeSheet.id, to: sheet });
                    }
                    break;
                case "MOVE_SHEET":
                    this.moveSheet(cmd.sheet, cmd.direction);
                    break;
                case "RENAME_SHEET":
                    if (cmd.interactive) {
                        this.interactiveRenameSheet(cmd.sheet, _lt("Rename Sheet"));
                    }
                    else {
                        this.renameSheet(cmd.sheet, cmd.name);
                    }
                    break;
                case "DUPLICATE_SHEET":
                    this.duplicateSheet(cmd.sheet, cmd.id, cmd.name);
                    break;
                case "DELETE_SHEET_CONFIRMATION":
                    this.interactiveDeleteSheet(cmd.sheet);
                    break;
                case "DELETE_SHEET":
                    this.deleteSheet(cmd.sheet);
                    break;
                case "DELETE_CONTENT":
                    this.clearZones(cmd.sheet, cmd.target);
                    break;
                case "SET_VALUE":
                    const [col, row] = toCartesian(cmd.xc);
                    this.dispatch("UPDATE_CELL", {
                        sheet: cmd.sheetId ? cmd.sheetId : this.workbook.activeSheet.id,
                        col,
                        row,
                        content: cmd.text,
                    });
                    break;
                case "UPDATE_CELL":
                    this.updateCell(cmd.sheet, cmd.col, cmd.row, cmd);
                    break;
                case "CLEAR_CELL":
                    this.dispatch("UPDATE_CELL", {
                        sheet: cmd.sheet,
                        col: cmd.col,
                        row: cmd.row,
                        content: "",
                        border: 0,
                        style: 0,
                        format: "",
                    });
                    break;
                case "AUTORESIZE_COLUMNS":
                    for (let col of cmd.cols) {
                        const size = this.getColMaxWidth(col);
                        if (size !== 0) {
                            this.setColSize(cmd.sheet, col, size + 2 * MIN_PADDING);
                        }
                    }
                    break;
                case "AUTORESIZE_ROWS":
                    for (let col of cmd.rows) {
                        const size = this.getRowMaxHeight(col);
                        if (size !== 0) {
                            this.setRowSize(cmd.sheet, col, size + 2 * MIN_PADDING);
                        }
                    }
                    break;
                case "RESIZE_COLUMNS":
                    for (let col of cmd.cols) {
                        this.setColSize(cmd.sheet, col, cmd.size);
                    }
                    break;
                case "RESIZE_ROWS":
                    for (let row of cmd.rows) {
                        this.setRowSize(cmd.sheet, row, cmd.size);
                    }
                    break;
                case "REMOVE_COLUMNS":
                    this.removeColumns(cmd.sheet, cmd.columns);
                    this.history.updateState(["sheets", cmd.sheet, "colNumber"], this.workbook.sheets[cmd.sheet].colNumber - cmd.columns.length);
                    break;
                case "REMOVE_ROWS":
                    this.removeRows(cmd.sheet, cmd.rows);
                    this.history.updateState(["sheets", cmd.sheet, "rowNumber"], this.workbook.sheets[cmd.sheet].rowNumber - cmd.rows.length);
                    break;
                case "ADD_COLUMNS":
                    this.addColumns(cmd.sheet, cmd.column, cmd.position, cmd.quantity);
                    this.history.updateState(["activeSheet", "colNumber"], this.workbook.activeSheet.colNumber + cmd.quantity);
                    break;
                case "ADD_ROWS":
                    this.addRows(cmd.sheet, cmd.row, cmd.position, cmd.quantity);
                    this.history.updateState(["activeSheet", "rowNumber"], this.workbook.activeSheet.rowNumber + cmd.quantity);
                    break;
                case "SET_FORMULA_VISIBILITY":
                    this.showFormulas = cmd.show;
                    break;
            }
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        applyOffset(formula, offsetX, offsetY) {
            return rangeTokenize(formula)
                .map((t) => {
                if (t.type === "SYMBOL" && cellReference.test(t.value)) {
                    const [xcs, sheetName] = t.value.split("!").reverse();
                    const sheetId = this.getSheetIdByName(sheetName);
                    if (xcs.includes(":")) {
                        return this.updateRange(xcs, offsetX, offsetY, sheetId);
                    }
                    return this.updateReference(xcs, offsetX, offsetY, sheetId, true, false);
                }
                return t.value;
            })
                .join("");
        }
        getCell(col, row, sheetName) {
            let r;
            if (!sheetName) {
                r = this.workbook.activeSheet.rows[row];
            }
            else {
                const sheet = Object.values(this.workbook.sheets).find((x) => x.name === sheetName);
                if (sheet) {
                    r = sheet.rows[row];
                }
                else {
                    return null;
                }
            }
            return r ? r.cells[col] || null : null;
        }
        getCellText(cell) {
            const value = this.showFormulas ? cell.content : cell.value;
            const shouldFormat = (value || value === 0) && cell.format && !cell.error && !cell.pending;
            const dateTimeFormat = shouldFormat && cell.format.match(/y|m|d|:/);
            const numberFormat = shouldFormat && !dateTimeFormat;
            switch (typeof value) {
                case "string":
                    return value;
                case "boolean":
                    return value ? "TRUE" : "FALSE";
                case "number":
                    if (dateTimeFormat) {
                        return formatDateTime({ value, format: cell.format });
                    }
                    if (numberFormat) {
                        return formatNumber(value, cell.format);
                    }
                    return formatStandardNumber(value);
                case "object":
                    if (!value)
                        return "0";
                    if ("value" in value && "format" in value) {
                        if (dateTimeFormat) {
                            return formatDateTime(value, cell.format);
                        }
                        if (numberFormat) {
                            return formatNumber(value.value, cell.format);
                        }
                        if (value && value.format.match(/y|m|d|:/)) {
                            return formatDateTime(value);
                        }
                    }
                    return value.toString();
            }
            return "";
        }
        /**
         * Converts a zone to a XC coordinate system
         *
         * The conversion also treats merges as one single cell
         *
         * Examples:
         * {top:0,left:0,right:0,bottom:0} ==> A1
         * {top:0,left:0,right:1,bottom:1} ==> A1:B2
         *
         * if A1:B2 is a merge:
         * {top:0,left:0,right:1,bottom:1} ==> A1
         * {top:1,left:0,right:1,bottom:2} ==> A1:B3
         *
         * if A1:B2 and A4:B5 are merges:
         * {top:1,left:0,right:1,bottom:3} ==> A1:A5
         */
        zoneToXC(zone) {
            zone = this.getters.expandZone(zone);
            const topLeft = toXC(zone.left, zone.top);
            const botRight = toXC(zone.right, zone.bottom);
            if (topLeft != botRight &&
                this.getters.getMainCell(topLeft) !== this.getters.getMainCell(botRight)) {
                return topLeft + ":" + botRight;
            }
            return topLeft;
        }
        /**
         * Returns the id (not the name) of the currently active sheet
         */
        getActiveSheet() {
            return this.workbook.activeSheet.id;
        }
        getSheetName(sheetId) {
            return this.workbook.sheets[sheetId] && this.workbook.sheets[sheetId].name;
        }
        getSheetIdByName(name) {
            return name && this.sheetIds[getUnquotedSheetName(name)];
        }
        getSheets() {
            const { visibleSheets, sheets } = this.workbook;
            return visibleSheets.map((id) => sheets[id]);
        }
        getCol(sheetId, index) {
            return this.workbook.sheets[sheetId].cols[index];
        }
        getRow(sheetId, index) {
            return this.workbook.sheets[sheetId].rows[index];
        }
        /**
         * Returns all the cells of a col
         */
        getColCells(col) {
            return this.workbook.activeSheet.rows.reduce((acc, cur) => (cur.cells[col] ? acc.concat(cur.cells[col]) : acc), []);
        }
        getNumberCols(sheetId) {
            return this.workbook.sheets[sheetId].cols.length;
        }
        getNumberRows(sheetId) {
            return this.workbook.sheets[sheetId].rows.length;
        }
        getColsZone(start, end) {
            return {
                top: 0,
                bottom: this.workbook.activeSheet.rows.length - 1,
                left: start,
                right: end,
            };
        }
        getRowsZone(start, end) {
            return {
                top: start,
                bottom: end,
                left: 0,
                right: this.workbook.activeSheet.cols.length - 1,
            };
        }
        getGridSize() {
            const activeSheet = this.workbook.activeSheet;
            const height = activeSheet.rows[activeSheet.rows.length - 1].end + DEFAULT_CELL_HEIGHT + 5;
            const width = activeSheet.cols[activeSheet.cols.length - 1].end + DEFAULT_CELL_WIDTH;
            return [width, height];
        }
        shouldShowFormulas() {
            return this.showFormulas;
        }
        getRangeValues(reference, defaultSheetId) {
            const [range, sheetName] = reference.split("!").reverse();
            const sheetId = sheetName ? this.sheetIds[sheetName] : defaultSheetId;
            return mapCellsInZone(toZone(range), this.workbook.sheets[sheetId], (cell) => cell.value);
        }
        getRangeFormattedValues(reference, defaultSheetId) {
            const [range, sheetName] = reference.split("!").reverse();
            const sheetId = sheetName ? this.sheetIds[sheetName] : defaultSheetId;
            return mapCellsInZone(toZone(range), this.workbook.sheets[sheetId], this.getters.getCellText, "");
        }
        // ---------------------------------------------------------------------------
        // Row/Col manipulation
        // ---------------------------------------------------------------------------
        getColMaxWidth(index) {
            const cells = this.workbook.activeSheet.rows.reduce((acc, cur) => (cur.cells[index] ? acc.concat(cur.cells[index]) : acc), []);
            const sizes = cells.map(this.getters.getCellWidth);
            return Math.max(0, ...sizes);
        }
        getRowMaxHeight(index) {
            const cells = Object.values(this.workbook.activeSheet.rows[index].cells);
            const sizes = cells.map(this.getters.getCellHeight);
            return Math.max(0, ...sizes);
        }
        setColSize(sheetId, index, size) {
            const cols = this.workbook.sheets[sheetId].cols;
            const col = cols[index];
            const delta = size - col.size;
            this.history.updateState(["sheets", sheetId, "cols", index, "size"], size);
            this.history.updateState(["sheets", sheetId, "cols", index, "end"], col.end + delta);
            for (let i = index + 1; i < cols.length; i++) {
                const col = cols[i];
                this.history.updateState(["sheets", sheetId, "cols", i, "start"], col.start + delta);
                this.history.updateState(["sheets", sheetId, "cols", i, "end"], col.end + delta);
            }
        }
        setRowSize(sheetId, index, size) {
            const rows = this.workbook.sheets[sheetId].rows;
            const row = rows[index];
            const delta = size - row.size;
            this.history.updateState(["sheets", sheetId, "rows", index, "size"], size);
            this.history.updateState(["sheets", sheetId, "rows", index, "end"], row.end + delta);
            for (let i = index + 1; i < rows.length; i++) {
                const row = rows[i];
                this.history.updateState(["sheets", sheetId, "rows", i, "start"], row.start + delta);
                this.history.updateState(["sheets", sheetId, "rows", i, "end"], row.end + delta);
            }
        }
        /**
         * Delete column. This requires a lot of handling:
         * - Update all the formulas in all sheets
         * - Move the cells
         * - Update the cols/rows (size, number, (cells), ...)
         * - Reevaluate the cells
         *
         * @param sheetID ID of the sheet on which deletion should be applied
         * @param columns Columns to delete
         */
        removeColumns(sheetID, columns) {
            // This is necessary because we have to delete elements in correct order:
            // begin with the end.
            columns.sort((a, b) => b - a);
            for (let column of columns) {
                // Update all the formulas.
                this.updateColumnsFormulas(column, -1, sheetID);
                // Move the cells.
                this.moveCellsHorizontally(column, -1, sheetID);
                // Effectively delete the element and recompute the left-right.
                this.manageColumnsHeaders(column, -1, sheetID);
            }
        }
        /**
         * Delete row. This requires a lot of handling:
         * - Update the merges
         * - Update all the formulas in all sheets
         * - Move the cells
         * - Update the cols/rows (size, number, (cells), ...)
         * - Reevaluate the cells
         *
         * @param sheetID ID of the sheet on which deletion should be applied
         * @param rows Rows to delete
         */
        removeRows(sheetID, rows) {
            // This is necessary because we have to delete elements in correct order:
            // begin with the end.
            rows.sort((a, b) => b - a);
            const consecutiveRows = rows.reduce((groups, currentRow, index, rows) => {
                if (currentRow - rows[index - 1] === -1) {
                    const lastGroup = groups[groups.length - 1];
                    lastGroup.push(currentRow);
                }
                else {
                    groups.push([currentRow]);
                }
                return groups;
            }, []);
            for (let group of consecutiveRows) {
                // Update all the formulas.
                this.updateRowsFormulas(group[0], -group.length, sheetID);
                // Move the cells.
                this.moveCellVerticallyBatched(group[group.length - 1], group[0], sheetID);
                // Effectively delete the element and recompute the left-right/top-bottom.
                group.map((row) => this.processRowsHeaderDelete(row, sheetID));
            }
        }
        addColumns(sheetID, column, position, quantity) {
            // Update all the formulas.
            this.updateColumnsFormulas(position === "before" ? column - 1 : column, quantity, sheetID);
            // Move the cells.
            this.moveCellsHorizontally(position === "before" ? column : column + 1, quantity, sheetID);
            // Recompute the left-right/top-bottom.
            this.manageColumnsHeaders(column, quantity, sheetID);
        }
        addRows(sheetID, row, position, quantity) {
            for (let i = 0; i < quantity; i++) {
                this.addEmptyRow();
            }
            // Update all the formulas.
            this.updateRowsFormulas(position === "before" ? row - 1 : row, quantity, sheetID);
            // Move the cells.
            this.moveCellsVertically(position === "before" ? row : row + 1, quantity, sheetID);
            // Recompute the left-right/top-bottom.
            this.processRowsHeaderAdd(row, quantity);
        }
        moveCellsHorizontally(base, step, sheetID) {
            return this.processCellsToMove((cell) => cell.col >= base, (cell) => cell.col !== base || step !== -1, (cell) => {
                return {
                    type: "UPDATE_CELL",
                    sheet: sheetID,
                    col: cell.col + step,
                    row: cell.row,
                    content: cell.content,
                    border: cell.border,
                    style: cell.style,
                    format: cell.format,
                };
            }, sheetID);
        }
        /**
         * Move all the cells that are from the row under `deleteToRow` up to `deleteFromRow`
         *
         * b.e.
         * move vertically with delete from 3 and delete to 5 will first clear all the cells from lines 3 to 5,
         * then take all the row starting at index 6 and add them back at index 3
         *
         * @param deleteFromRow the row index from which to start deleting
         * @param deleteToRow the row index until which the deleting must continue
         * @param the sheet from which to remove
         */
        moveCellVerticallyBatched(deleteFromRow, deleteToRow, sheetID) {
            return this.processCellsToMove(({ row }) => row >= deleteFromRow, ({ row }) => row > deleteToRow, (cell) => {
                return {
                    type: "UPDATE_CELL",
                    sheet: this.workbook.sheets[sheetID].id,
                    col: cell.col,
                    row: cell.row - (deleteToRow - deleteFromRow + 1),
                    content: cell.content,
                    border: cell.border,
                    style: cell.style,
                    format: cell.format,
                };
            }, sheetID);
        }
        moveCellsVertically(base, step, sheetID) {
            return this.processCellsToMove((cell) => cell.row >= base, (cell) => cell.row !== base || step !== -1, (cell) => {
                return {
                    type: "UPDATE_CELL",
                    sheet: sheetID,
                    col: cell.col,
                    row: cell.row + step,
                    content: cell.content,
                    border: cell.border,
                    style: cell.style,
                    format: cell.format,
                };
            }, sheetID);
        }
        manageColumnsHeaders(base, step, sheetID) {
            const cols = [];
            let start = 0;
            let colIndex = 0;
            const sheet = this.workbook.sheets[sheetID];
            for (let i in sheet.cols) {
                if (parseInt(i, 10) === base) {
                    if (step !== -1) {
                        const { size } = sheet.cols[colIndex];
                        for (let a = 0; a < step; a++) {
                            cols.push({
                                name: numberToLetters(colIndex),
                                size,
                                start,
                                end: start + size,
                            });
                            start += size;
                            colIndex++;
                        }
                    }
                    else {
                        continue;
                    }
                }
                const { size } = sheet.cols[i];
                cols.push({
                    name: numberToLetters(colIndex),
                    size,
                    start,
                    end: start + size,
                });
                start += size;
                colIndex++;
            }
            this.history.updateState(["sheets", sheetID, "cols"], cols);
        }
        processRowsHeaderDelete(index, sheetID) {
            const rows = [];
            let start = 0;
            let rowIndex = 0;
            const sheet = this.workbook.sheets[sheetID];
            const cellsQueue = sheet.rows.map((row) => row.cells);
            for (let i in sheet.rows) {
                const row = sheet.rows[i];
                const { size } = row;
                if (parseInt(i, 10) === index) {
                    continue;
                }
                rowIndex++;
                rows.push({
                    start,
                    end: start + size,
                    size,
                    cells: cellsQueue.shift(),
                    name: String(rowIndex),
                });
                start += size;
            }
            this.history.updateState(["sheets", sheetID, "rows"], rows);
        }
        processRowsHeaderAdd(index, quantity) {
            const rows = [];
            let start = 0;
            let rowIndex = 0;
            let sizeIndex = 0;
            const cellsQueue = this.workbook.activeSheet.rows.map((row) => row.cells);
            for (let i in this.workbook.activeSheet.rows) {
                const { size } = this.workbook.activeSheet.rows[sizeIndex];
                if (parseInt(i, 10) < index || parseInt(i, 10) >= index + quantity) {
                    sizeIndex++;
                }
                rowIndex++;
                rows.push({
                    start,
                    end: start + size,
                    size,
                    cells: cellsQueue.shift(),
                    name: String(rowIndex),
                });
                start += size;
            }
            this.history.updateState(["activeSheet", "rows"], rows);
        }
        addEmptyRow() {
            const lastEnd = this.workbook.activeSheet.rows[this.workbook.activeSheet.rows.length - 1].end;
            const name = (this.workbook.activeSheet.rows.length + 1).toString();
            const newRows = this.workbook.activeSheet.rows.slice();
            const size = 0;
            newRows.push({
                start: lastEnd,
                end: lastEnd + size,
                size,
                name,
                cells: {},
            });
            const path = ["activeSheet", "rows"];
            this.history.updateState(path, newRows);
        }
        updateColumnsFormulas(base, step, sheetID) {
            return this.visitFormulas(this.workbook.sheets[sheetID].name, (value, sheet) => {
                if (value.includes(":")) {
                    return this.updateColumnsRange(value, sheet, base, step);
                }
                return this.updateColumnsRef(value, sheet, base, step);
            });
        }
        updateRowsFormulas(base, step, sheetID) {
            return this.visitFormulas(this.workbook.sheets[sheetID].name, (value, sheet) => {
                if (value.includes(":")) {
                    return this.updateRowsRange(value, sheet, base, step);
                }
                return this.updateRowsRef(value, sheet, base, step);
            });
        }
        processCellsToMove(shouldDelete, shouldAdd, buildCellToAdd, sheetId) {
            const deleteCommands = [];
            const addCommands = [];
            const sheet = this.workbook.sheets[sheetId];
            for (let xc in sheet.cells) {
                let cell = sheet.cells[xc];
                if (shouldDelete(cell)) {
                    const [col, row] = toCartesian(xc);
                    deleteCommands.push({
                        type: "CLEAR_CELL",
                        sheet: sheet.id,
                        col,
                        row,
                    });
                    if (shouldAdd(cell)) {
                        addCommands.push(buildCellToAdd(cell));
                    }
                }
            }
            for (let cmd of deleteCommands) {
                this.dispatch(cmd.type, cmd);
            }
            for (let cmd of addCommands) {
                this.dispatch(cmd.type, cmd);
            }
        }
        // ---------------------------------------------------------------------------
        // Cells
        // ---------------------------------------------------------------------------
        updateCell(sheet, col, row, data) {
            const _sheet = this.workbook.sheets[sheet];
            const current = _sheet.rows[row].cells[col];
            const xc = (current && current.xc) || toXC(col, row);
            const hasContent = "content" in data;
            // Compute the new cell properties
            const dataContent = data.content ? data.content.replace(nbspRegexp, "") : "";
            let content = hasContent ? dataContent : (current && current.content) || "";
            const style = "style" in data ? data.style : (current && current.style) || 0;
            const border = "border" in data ? data.border : (current && current.border) || 0;
            let format = "format" in data ? data.format : (current && current.format) || "";
            // if all are empty, we need to delete the underlying cell object
            if (!content && !style && !border && !format) {
                if (current) {
                    // todo: make this work on other sheets
                    this.history.updateSheet(_sheet, ["cells", xc], undefined);
                    this.history.updateSheet(_sheet, ["rows", row, "cells", col], undefined);
                }
                return;
            }
            // compute the new cell value
            const didContentChange = (!current && dataContent) || (hasContent && current && current.content !== dataContent);
            let cell;
            if (current && !didContentChange) {
                cell = { col, row, xc, content, value: current.value, type: current.type };
                if (cell.type === "formula") {
                    cell.error = current.error;
                    cell.pending = current.pending;
                    cell.formula = current.formula;
                }
            }
            else {
                // the current content cannot be reused, so we need to recompute the
                // derived values
                let type = content[0] === "=" ? "formula" : "text";
                let value = content;
                if (isNumber(content)) {
                    value = parseNumber(content);
                    type = "number";
                    if (content.includes("%")) {
                        format = content.includes(".") ? "0.00%" : "0%";
                    }
                }
                let date = parseDateTime(content);
                if (date) {
                    type = "date";
                    value = date;
                    content = formatDateTime(date);
                }
                const contentUpperCase = content.toUpperCase();
                if (contentUpperCase === "TRUE") {
                    value = true;
                }
                if (contentUpperCase === "FALSE") {
                    value = false;
                }
                cell = { col, row, xc, content, value, type };
                if (cell.type === "formula") {
                    cell.error = undefined;
                    try {
                        let formulaString = normalize(cell.content || "");
                        let compiledFormula = compile(formulaString);
                        cell.formula = {
                            compiledFormula: compiledFormula,
                            dependencies: formulaString.dependencies,
                            text: formulaString.text,
                        };
                    }
                    catch (e) {
                        cell.value = "#BAD_EXPR";
                        cell.error = e.message || _lt("Invalid Expression");
                    }
                }
            }
            if (style) {
                cell.style = style;
            }
            if (border) {
                cell.border = border;
            }
            if (format) {
                cell.format = format;
            }
            // todo: make this work on other sheets
            this.history.updateSheet(_sheet, ["cells", xc], cell);
            this.history.updateSheet(_sheet, ["rows", row, "cells", col], cell);
        }
        generateSheetName() {
            let i = 1;
            const names = this.getSheets().map((s) => s.name);
            const baseName = _lt("Sheet");
            let name = `${baseName}${i}`;
            while (names.includes(name)) {
                name = `${baseName}${i}`;
                i++;
            }
            return name;
        }
        createSheet(id, name, cols, rows) {
            const sheet = {
                id,
                name,
                cells: {},
                colNumber: cols,
                rowNumber: rows,
                cols: createDefaultCols(cols),
                rows: createDefaultRows(rows),
                merges: {},
                mergeCellMap: {},
            };
            const visibleSheets = this.workbook.visibleSheets.slice();
            const index = visibleSheets.findIndex((id) => this.workbook.activeSheet.id === id);
            visibleSheets.splice(index + 1, 0, sheet.id);
            const sheets = this.workbook.sheets;
            this.history.updateState(["visibleSheets"], visibleSheets);
            this.history.updateState(["sheets"], Object.assign({}, sheets, { [sheet.id]: sheet }));
            return sheet.id;
        }
        moveSheet(sheetId, direction) {
            const visibleSheets = this.workbook.visibleSheets.slice();
            const currentIndex = visibleSheets.findIndex((id) => id === sheetId);
            const sheet = visibleSheets.splice(currentIndex, 1);
            visibleSheets.splice(currentIndex + (direction === "left" ? -1 : 1), 0, sheet[0]);
            this.history.updateState(["visibleSheets"], visibleSheets);
        }
        isRenameAllowed(cmd) {
            if (cmd.interactive) {
                return { status: "SUCCESS" };
            }
            const name = cmd.name && cmd.name.trim().toLowerCase();
            if (!name) {
                return { status: "CANCELLED", reason: 8 /* WrongSheetName */ };
            }
            return this.workbook.visibleSheets.findIndex((id) => this.workbook.sheets[id].name.toLowerCase() === name) === -1
                ? { status: "SUCCESS" }
                : { status: "CANCELLED", reason: 8 /* WrongSheetName */ };
        }
        interactiveRenameSheet(sheet, title) {
            const placeholder = this.getSheetName(sheet);
            this.ui.editText(title, placeholder, (name) => {
                if (!name) {
                    return;
                }
                const result = this.dispatch("RENAME_SHEET", { sheet, name });
                const sheetName = this.getSheetName(sheet);
                if (result.status === "CANCELLED" && sheetName !== name) {
                    this.interactiveRenameSheet(sheet, _lt("Please enter a valid sheet name"));
                }
            });
        }
        renameSheet(sheetId, name) {
            const sheet = this.workbook.sheets[sheetId];
            const oldName = sheet.name;
            this.history.updateSheet(sheet, ["name"], name.trim());
            const sheetIds = Object.assign({}, this.sheetIds);
            sheetIds[name] = sheet.id;
            delete sheetIds[oldName];
            this.history.updateLocalState(["sheetIds"], sheetIds);
            this.visitAllFormulasSymbols((value) => {
                let [val, sheetRef] = value.split("!").reverse();
                if (sheetRef) {
                    sheetRef = getUnquotedSheetName(sheetRef);
                    if (sheetRef === oldName) {
                        if (val.includes(":")) {
                            return this.updateRange(val, 0, 0, sheet.id);
                        }
                        return this.updateReference(val, 0, 0, sheet.id);
                    }
                }
                return value;
            });
        }
        duplicateSheet(fromId, toId, toName) {
            const sheet = this.workbook.sheets[fromId];
            const newSheet = JSON.parse(JSON.stringify(sheet));
            newSheet.id = toId;
            newSheet.name = toName;
            const visibleSheets = this.workbook.visibleSheets.slice();
            const currentIndex = visibleSheets.findIndex((id) => id === fromId);
            visibleSheets.splice(currentIndex + 1, 0, newSheet.id);
            this.history.updateState(["visibleSheets"], visibleSheets);
            this.history.updateState(["sheets"], Object.assign({}, this.workbook.sheets, { [newSheet.id]: newSheet }));
            const sheetIds = Object.assign({}, this.sheetIds);
            sheetIds[newSheet.name] = newSheet.id;
            this.history.updateLocalState(["sheetIds"], sheetIds);
            this.dispatch("ACTIVATE_SHEET", { from: this.workbook.activeSheet.id, to: toId });
        }
        interactiveDeleteSheet(sheetId) {
            this.ui.askConfirmation(_lt("Are you sure you want to delete this sheet ?"), () => {
                this.dispatch("DELETE_SHEET", { sheet: sheetId });
            });
        }
        deleteSheet(sheetId) {
            const name = this.workbook.sheets[sheetId].name;
            const sheets = Object.assign({}, this.workbook.sheets);
            delete sheets[sheetId];
            this.history.updateState(["sheets"], sheets);
            const visibleSheets = this.workbook.visibleSheets.slice();
            const currentIndex = visibleSheets.findIndex((id) => id === sheetId);
            visibleSheets.splice(currentIndex, 1);
            this.history.updateState(["visibleSheets"], visibleSheets);
            const sheetIds = Object.assign({}, this.sheetIds);
            delete sheetIds[name];
            this.history.updateLocalState(["sheetIds"], sheetIds);
            this.visitAllFormulasSymbols((value) => {
                let [, sheetRef] = value.split("!").reverse();
                if (sheetRef) {
                    sheetRef = getUnquotedSheetName(sheetRef);
                    if (sheetRef === name) {
                        return "#REF";
                    }
                }
                return value;
            });
            if (this.getActiveSheet() === sheetId) {
                this.dispatch("ACTIVATE_SHEET", {
                    from: sheetId,
                    to: visibleSheets[Math.max(0, currentIndex - 1)],
                });
            }
        }
        clearZones(sheet, zones) {
            // TODO: get cells from the actual sheet
            const cells = this.workbook.activeSheet.cells;
            for (let zone of zones) {
                for (let col = zone.left; col <= zone.right; col++) {
                    for (let row = zone.top; row <= zone.bottom; row++) {
                        const xc = toXC(col, row);
                        if (xc in cells) {
                            this.dispatch("UPDATE_CELL", {
                                sheet,
                                content: "",
                                col,
                                row,
                            });
                        }
                    }
                }
            }
        }
        // ---------------------------------------------------------------------------
        // Helpers
        // ---------------------------------------------------------------------------
        /**
         * Update a range with some offsets
         */
        updateRange(symbol, offsetX, offsetY, sheetId) {
            let [left, right] = symbol.split(":");
            left = this.updateReference(left, offsetX, offsetY, sheetId, true, false);
            right = this.updateReference(right, offsetX, offsetY, sheetId, true, false);
            if (left === "#REF" || right === "#REF") {
                return "#REF";
            }
            //As updateReference put the sheet in the ref, we need to remove it from the right part
            right = right.split("!").pop();
            return `${left}:${right}`;
        }
        /**
         * Update a reference with some offsets.
         */
        updateReference(symbol, offsetX, offsetY, sheetId, updateFreeze = true, checkSheetBoundary = true) {
            const xc = symbol.replace(/\$/g, "");
            let [x, y] = toCartesian(xc);
            const freezeCol = symbol.startsWith("$");
            const freezeRow = symbol.includes("$", 1);
            x += freezeCol && updateFreeze ? 0 : offsetX;
            y += freezeRow && updateFreeze ? 0 : offsetY;
            if (x < 0 ||
                y < 0 ||
                (checkSheetBoundary &&
                    (x >= this.getters.getNumberCols(sheetId || this.getters.getActiveSheet()) ||
                        y >= this.getters.getNumberRows(sheetId || this.getters.getActiveSheet())))) {
                return "#REF";
            }
            const sheetName = sheetId && getComposerSheetName(this.getters.getSheetName(sheetId));
            return ((sheetName ? `${sheetName}!` : "") +
                (freezeCol ? "$" : "") +
                numberToLetters(x) +
                (freezeRow ? "$" : "") +
                String(y + 1));
        }
        visitAllFormulasSymbols(cb) {
            for (let sheetId in this.workbook.sheets) {
                const sheet = this.workbook.sheets[sheetId];
                for (let [xc, cell] of Object.entries(sheet.cells)) {
                    if (cell.type === "formula") {
                        const content = rangeTokenize(cell.content)
                            .map((t) => {
                            if (t.type === "SYMBOL" && cellReference.test(t.value)) {
                                return cb(t.value, sheet.id);
                            }
                            return t.value;
                        })
                            .join("");
                        if (content !== cell.content) {
                            const [col, row] = toCartesian(xc);
                            this.dispatch("UPDATE_CELL", {
                                sheet: sheet.id,
                                col,
                                row,
                                content,
                            });
                        }
                    }
                }
            }
        }
        /**
         * Apply a function to update the formula on every cells of every sheets which
         * contains a formula
         * @param cb Update formula function to apply
         */
        visitFormulas(sheetNameToFind, cb) {
            this.visitAllFormulasSymbols((content, sheetId) => {
                let [value, sheetRef] = content.split("!").reverse();
                if (sheetRef) {
                    sheetRef = getUnquotedSheetName(sheetRef);
                    if (sheetRef === sheetNameToFind) {
                        return cb(value, sheetRef);
                    }
                }
                else if (this.sheetIds[sheetNameToFind] === sheetId) {
                    return cb(value, undefined);
                }
                return content;
            });
        }
        // ---------------------------------------------------------------------------
        // Import/Export
        // ---------------------------------------------------------------------------
        import(data) {
            // we need to fill the sheetIds mapping first, because otherwise formulas
            // that depends on a sheet not already imported will not be able to be
            // compiled
            for (let sheet of data.sheets) {
                this.sheetIds[sheet.name] = sheet.id;
            }
            for (let sheet of data.sheets) {
                this.importSheet(sheet);
            }
            this.workbook.activeSheet = this.workbook.sheets[data.activeSheet];
        }
        importSheet(data) {
            let { sheets, visibleSheets } = this.workbook;
            const name = data.name || `Sheet${Object.keys(sheets).length + 1}`;
            const { colNumber, rowNumber } = getSheetSize(data);
            const sheet = {
                id: data.id,
                name: name,
                cells: {},
                colNumber,
                rowNumber,
                cols: createCols(data.cols || {}, colNumber),
                rows: createRows(data.rows || {}, rowNumber),
                merges: {},
                mergeCellMap: {},
            };
            visibleSheets = visibleSheets.slice();
            visibleSheets.push(sheet.id);
            this.history.updateState(["visibleSheets"], visibleSheets);
            this.history.updateState(["sheets"], Object.assign({}, sheets, { [sheet.id]: sheet }));
            // cells
            for (let xc in data.cells) {
                const cell = data.cells[xc];
                const [col, row] = toCartesian(xc);
                this.updateCell(data.id, col, row, cell);
            }
        }
        export(data) {
            data.sheets = this.workbook.visibleSheets.map((id) => {
                const sheet = this.workbook.sheets[id];
                const cells = {};
                for (let [key, cell] of Object.entries(sheet.cells)) {
                    cells[key] = {
                        content: cell.content,
                        border: cell.border,
                        style: cell.style,
                        format: cell.format,
                    };
                }
                return {
                    id: sheet.id,
                    name: sheet.name,
                    colNumber: sheet.colNumber,
                    rowNumber: sheet.rowNumber,
                    rows: exportRows(sheet.rows),
                    cols: exportCols(sheet.cols),
                    merges: [],
                    cells: cells,
                    conditionalFormats: [],
                    figures: [],
                };
            });
            data.activeSheet = this.workbook.activeSheet.id;
        }
    }
    CorePlugin.getters = [
        "applyOffset",
        "getColsZone",
        "getRowsZone",
        "getCell",
        "getCellText",
        "zoneToXC",
        "getActiveSheet",
        "getSheetName",
        "getSheetIdByName",
        "getSheets",
        "getCol",
        "getRow",
        "getColCells",
        "getNumberCols",
        "getNumberRows",
        "getGridSize",
        "shouldShowFormulas",
        "getRangeValues",
        "getRangeFormattedValues",
    ];
    function getSheetSize(data) {
        const positions = Object.keys(data.cells).map(toCartesian);
        return {
            rowNumber: Math.max(data.rowNumber, ...new Set(positions.map(([col, row]) => row + 1))),
            colNumber: Math.max(data.colNumber, ...new Set(positions.map(([col, row]) => col + 1))),
        };
    }
    function createDefaultCols(colNumber) {
        const cols = [];
        let current = 0;
        for (let i = 0; i < colNumber; i++) {
            const size = DEFAULT_CELL_WIDTH;
            const col = {
                start: current,
                end: current + size,
                size: size,
                name: numberToLetters(i),
            };
            cols.push(col);
            current = col.end;
        }
        return cols;
    }
    function createDefaultRows(rowNumber) {
        const rows = [];
        let current = 0;
        for (let i = 0; i < rowNumber; i++) {
            const size = DEFAULT_CELL_HEIGHT;
            const row = {
                start: current,
                end: current + size,
                size: size,
                name: String(i + 1),
                cells: {},
            };
            rows.push(row);
            current = row.end;
        }
        return rows;
    }
    function createCols(savedCols, colNumber) {
        const cols = [];
        let current = 0;
        for (let i = 0; i < colNumber; i++) {
            const size = savedCols[i] ? savedCols[i].size || DEFAULT_CELL_WIDTH : DEFAULT_CELL_WIDTH;
            const col = {
                start: current,
                end: current + size,
                size: size,
                name: numberToLetters(i),
            };
            cols.push(col);
            current = col.end;
        }
        return cols;
    }
    function createRows(savedRows, rowNumber) {
        const rows = [];
        let current = 0;
        for (let i = 0; i < rowNumber; i++) {
            const size = savedRows[i] ? savedRows[i].size || DEFAULT_CELL_HEIGHT : DEFAULT_CELL_HEIGHT;
            const row = {
                start: current,
                end: current + size,
                size: size,
                name: String(i + 1),
                cells: {},
            };
            rows.push(row);
            current = row.end;
        }
        return rows;
    }
    function exportCols(cols) {
        const exportedCols = {};
        for (let i in cols) {
            const col = cols[i];
            if (col.size !== DEFAULT_CELL_WIDTH) {
                exportedCols[i] = { size: col.size };
            }
        }
        return exportedCols;
    }
    function exportRows(rows) {
        const exportedRows = {};
        for (let i in rows) {
            const row = rows[i];
            if (row.size !== DEFAULT_CELL_HEIGHT) {
                exportedRows[i] = { size: row.size };
            }
        }
        return exportedRows;
    }

    class EditionPlugin extends BasePlugin {
        constructor() {
            super(...arguments);
            this.col = 0;
            this.row = 0;
            this.mode = "inactive";
            this.sheet = "";
            this.currentContent = "";
        }
        // ---------------------------------------------------------------------------
        // Command Handling
        // ---------------------------------------------------------------------------
        beforeHandle(cmd) {
            switch (cmd.type) {
                case "ACTIVATE_SHEET":
                    if (this.mode !== "selecting") {
                        this.stopEdition();
                    }
                    break;
            }
        }
        handle(cmd) {
            switch (cmd.type) {
                case "START_COMPOSER_SELECTION":
                    this.mode = "selecting";
                    this.dispatch("SET_SELECTION", {
                        zones: this.getters.getSelectedZones(),
                        anchor: this.getters.getPosition(),
                    });
                    break;
                case "STOP_COMPOSER_SELECTION":
                    if (this.mode === "selecting") {
                        this.mode = "editing";
                    }
                    break;
                case "START_EDITION":
                    this.startEdition(cmd.text);
                    break;
                case "STOP_EDITION":
                    if (cmd.cancel) {
                        this.cancelEdition();
                    }
                    else {
                        this.stopEdition();
                    }
                    break;
                case "SET_CURRENT_CONTENT":
                    this.currentContent = cmd.content;
                    break;
                case "SELECT_CELL":
                case "MOVE_POSITION":
                    if (this.mode === "editing") {
                        this.stopEdition();
                    }
                    break;
            }
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        getEditionMode() {
            return this.mode;
        }
        getCurrentContent() {
            return this.currentContent;
        }
        getEditionSheet() {
            return this.sheet;
        }
        // ---------------------------------------------------------------------------
        // Misc
        // ---------------------------------------------------------------------------
        startEdition(str) {
            if (!str) {
                const cell = this.getters.getActiveCell();
                str = cell ? cell.content || "" : "";
            }
            this.mode = "editing";
            this.currentContent = str || "";
            this.dispatch("REMOVE_ALL_HIGHLIGHTS");
            const [col, row] = this.getters.getPosition();
            this.col = col;
            this.row = row;
            this.sheet = this.getters.getActiveSheet();
        }
        stopEdition() {
            if (this.mode !== "inactive") {
                this.cancelEdition();
                let xc = toXC(this.col, this.row);
                const { mergeCellMap, merges, cells } = this.getters
                    .getSheets()
                    .find((sheet) => sheet.id === this.sheet);
                if (xc in mergeCellMap) {
                    const mergeId = mergeCellMap[xc];
                    xc = merges[mergeId].topLeft;
                }
                let content = this.currentContent;
                this.currentContent = "";
                const cell = cells[xc];
                const didChange = cell ? cell.content !== content : content !== "";
                if (!didChange) {
                    return;
                }
                const [col, row] = toCartesian(xc);
                if (content) {
                    if (content.startsWith("=")) {
                        const tokens = tokenize(content);
                        const left = tokens.filter((t) => t.type === "LEFT_PAREN").length;
                        const right = tokens.filter((t) => t.type === "RIGHT_PAREN").length;
                        const missing = left - right;
                        if (missing > 0) {
                            content += new Array(missing).fill(")").join("");
                        }
                    }
                    this.dispatch("UPDATE_CELL", {
                        sheet: this.sheet,
                        col,
                        row,
                        content,
                    });
                }
                else {
                    this.dispatch("UPDATE_CELL", {
                        sheet: this.sheet,
                        content: "",
                        col,
                        row,
                    });
                }
                if (this.getters.getActiveSheet() !== this.sheet) {
                    this.dispatch("ACTIVATE_SHEET", { from: this.getters.getActiveSheet(), to: this.sheet });
                }
            }
        }
        cancelEdition() {
            this.mode = "inactive";
            this.dispatch("REMOVE_ALL_HIGHLIGHTS");
        }
    }
    EditionPlugin.layers = [1 /* Highlights */];
    EditionPlugin.getters = ["getEditionMode", "getCurrentContent", "getEditionSheet"];
    EditionPlugin.modes = ["normal", "readonly"];

    function* makeObjectIterator(obj) {
        for (let i in obj) {
            yield obj[i];
        }
    }
    function* makeSetIterator(set) {
        for (let elem of set) {
            yield elem;
        }
    }
    const functionMap = functionRegistry.mapping;
    const LOADING = "Loading...";
    class EvaluationPlugin extends BasePlugin {
        constructor(workbook, getters, history, dispatch, config) {
            super(workbook, getters, history, dispatch, config);
            this.isUptodate = new Set();
            this.loadingCells = 0;
            this.isStarted = false;
            /**
             * For all cells that are being currently computed (asynchronously).
             *
             * For example: =Wait(3)
             */
            this.PENDING = new Set();
            /**
             * For all cells that are NOT being currently computed, but depend on another
             * asynchronous computation.
             *
             * For example: A2 is in WAITING (initially) and A1 in PENDING
             *   A1: =Wait(3)
             *   A2: =A1
             */
            this.WAITING = {};
            /**
             * For all cells that have been async computed.
             *
             * For example:
             *  A1: =Wait(3)
             *  A2: =A1
             *
             * When A1 is computed, A1 is moved in COMPUTED
             */
            this.COMPUTED = new Set();
            this.evalContext = config.evalContext;
        }
        // ---------------------------------------------------------------------------
        // Command Handling
        // ---------------------------------------------------------------------------
        handle(cmd) {
            switch (cmd.type) {
                case "START":
                    this.evaluate();
                    break;
                case "UPDATE_CELL":
                    if ("content" in cmd) {
                        this.isUptodate.clear();
                    }
                    break;
                case "EVALUATE_CELLS":
                    if (cmd.onlyWaiting) {
                        for (const sheetId in this.WAITING) {
                            const cells = new Set(this.WAITING[sheetId]);
                            this.WAITING[sheetId].clear();
                            this.evaluateCells(makeSetIterator(cells), sheetId);
                        }
                    }
                    else {
                        for (const sheetId in this.WAITING) {
                            delete this.WAITING[sheetId];
                        }
                        this.evaluate();
                    }
                    this.isUptodate.add(this.workbook.activeSheet.id);
                    break;
                case "UNDO":
                case "REDO":
                    this.isUptodate.clear();
                    break;
            }
        }
        finalize() {
            if (!this.isUptodate.has(this.workbook.activeSheet.id)) {
                this.evaluate();
                this.isUptodate.add(this.workbook.activeSheet.id);
            }
            if (this.loadingCells > 0) {
                this.startScheduler();
            }
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        evaluateFormula(formula, sheet = this.workbook.activeSheet.id) {
            let formulaString = normalize(formula);
            const compiledFormula = compile(formulaString);
            const params = this.getFormulaParameters(() => { });
            return compiledFormula(formulaString.dependencies, sheet, ...params);
        }
        isIdle() {
            return this.loadingCells === 0;
        }
        // ---------------------------------------------------------------------------
        // Scheduler
        // ---------------------------------------------------------------------------
        startScheduler() {
            if (!this.isStarted) {
                this.isStarted = true;
                let current = this.loadingCells;
                const recomputeCells = () => {
                    if (this.loadingCells !== current) {
                        this.dispatch("EVALUATE_CELLS", { onlyWaiting: true });
                        current = this.loadingCells;
                        if (current === 0) {
                            this.isStarted = false;
                        }
                    }
                    if (current > 0) {
                        window.setTimeout(recomputeCells, 15);
                    }
                };
                window.setTimeout(recomputeCells, 5);
            }
        }
        // ---------------------------------------------------------------------------
        // Evaluator
        // ---------------------------------------------------------------------------
        evaluate() {
            this.COMPUTED.clear();
            this.evaluateCells(makeObjectIterator(this.workbook.activeSheet.cells), this.workbook.activeSheet.id);
        }
        evaluateCells(cells, sheetId) {
            const self = this;
            const { COMPUTED, PENDING, WAITING } = this;
            const params = this.getFormulaParameters(computeValue);
            const visited = {};
            const _cells = [...cells];
            for (let cell of _cells) {
                // Do not reset error when it's during the compilation
                if (cell.value !== "#BAD_EXPR") {
                    cell.error = undefined;
                }
            }
            for (let cell of _cells) {
                computeValue(cell, sheetId);
            }
            function handleError(e, currentCell, currentSheetId) {
                if (!(e instanceof Error)) {
                    e = new Error(e);
                }
                if (PENDING.has(currentCell)) {
                    PENDING.delete(currentCell);
                    self.loadingCells--;
                }
                if (e.message === "not ready") {
                    if (!WAITING[currentSheetId]) {
                        WAITING[currentSheetId] = new Set();
                    }
                    WAITING[currentSheetId].add(currentCell);
                    currentCell.pending = true;
                    currentCell.value = LOADING;
                }
                else if (!currentCell.error) {
                    currentCell.value = "#ERROR";
                    const __lastFnCalled = params[2].__lastFnCalled || "";
                    currentCell.error = e.message.replace("[[FUNCTION_NAME]]", __lastFnCalled);
                }
            }
            function computeValue(cell, sheetId) {
                if (cell.type !== "formula" || !cell.formula) {
                    return;
                }
                const xc = cell.xc;
                visited[sheetId] = visited[sheetId] || {};
                if (xc in visited[sheetId]) {
                    if (visited[sheetId][xc] === null) {
                        cell.value = "#CYCLE";
                        cell.error = _lt("Circular reference");
                    }
                    return;
                }
                if (COMPUTED.has(cell) || PENDING.has(cell)) {
                    return;
                }
                visited[sheetId][xc] = null;
                cell.error = undefined;
                try {
                    params[2].__originCellXC = xc;
                    // todo: move formatting in grid and formatters.js
                    if (cell.formula.compiledFormula.async) {
                        cell.value = LOADING;
                        cell.pending = true;
                        PENDING.add(cell);
                        cell.formula
                            .compiledFormula(cell.formula.dependencies, sheetId, ...params)
                            .then((val) => {
                            cell.value = val;
                            self.loadingCells--;
                            if (PENDING.has(cell)) {
                                PENDING.delete(cell);
                                cell.pending = false;
                                COMPUTED.add(cell);
                            }
                        })
                            .catch((e) => handleError(e, cell, sheetId));
                        self.loadingCells++;
                    }
                    else {
                        cell.value = cell.formula.compiledFormula(cell.formula.dependencies, sheetId, ...params);
                        cell.pending = false;
                    }
                    if (Array.isArray(cell.value)) {
                        // if a value returns an array (like =A1:A3)
                        throw new Error(_lt("This formula depends on invalid values"));
                    }
                    else {
                        cell.error = undefined;
                    }
                }
                catch (e) {
                    handleError(e, cell, sheetId);
                }
                visited[sheetId][xc] = true;
            }
        }
        /**
         * Return all functions necessary to properly evaluate a formula:
         * - a refFn function to read any reference, cell or range of a normalized formula
         * - a range function to convert any reference to a proper value array
         * - an evaluation context
         */
        getFormulaParameters(computeValue) {
            const evalContext = Object.assign(Object.create(functionMap), this.evalContext, {
                getters: this.getters,
            });
            const sheets = this.workbook.sheets;
            const PENDING = this.PENDING;
            function readCell(xc, sheetId) {
                let cell;
                const s = sheets[sheetId];
                if (s) {
                    cell = s.cells[xc.toUpperCase().replace(/\$/g, "")];
                }
                else {
                    throw new Error(_lt("Invalid sheet name"));
                }
                if (!cell || cell.content === "") {
                    return null;
                }
                const value = getCellValue(cell, sheetId);
                if (value === LOADING) {
                    throw new Error("not ready");
                }
                return value;
            }
            function getCellValue(cell, sheetId) {
                if (cell.formula && cell.formula.compiledFormula.async && cell.error && !PENDING.has(cell)) {
                    throw new Error(_lt("This formula depends on invalid values"));
                }
                computeValue(cell, sheetId);
                if (cell.error) {
                    throw new Error(_lt("This formula depends on invalid values"));
                }
                return cell.value;
            }
            /**
             * Return a range of values. It is a list of col values.
             *
             * Note that each col is possibly sparse: it only contain the values of cells
             * that are actually present in the grid.
             */
            function _range(v1, v2, sheetId) {
                const sheet = sheets[sheetId];
                let [left, top] = toCartesian(v1);
                let [right, bottom] = toCartesian(v2);
                right = Math.min(right, sheet.colNumber - 1);
                bottom = Math.min(bottom, sheet.rowNumber - 1);
                if (left > right) {
                    const tmp = left;
                    left = right;
                    right = tmp;
                }
                if (top > bottom) {
                    const tmp = top;
                    top = bottom;
                    bottom = tmp;
                }
                const zone = { left, top, right, bottom };
                const result = mapCellsInZone(zone, sheet, (cell) => getCellValue(cell, sheetId));
                for (const col of result) {
                    for (const value of col) {
                        if (value === LOADING) {
                            throw new Error("not ready");
                        }
                    }
                }
                return result;
            }
            /**
             * Returns the value of the cell(s) used in reference
             *
             * @param position the index in the references array
             * @param references all the references used in the current formula
             * @param sheetId the sheet that is currently being evaluated, if a reference does not
             *        include a sheet, it is the id of the sheet of the reference to be used
             */
            function refFn(position, references, sheetId, functionName, paramNumber) {
                const referenceText = references[position];
                const [reference, sheetName] = referenceText.split("!").reverse();
                const referenceSheetId = sheetName
                    ? evalContext.getters.getSheetIdByName(sheetName)
                    : sheetId;
                const zone = toZone(referenceText);
                if (zone.top > zone.bottom || zone.left > zone.right) {
                    throw new Error(_lt("invalid range %s:%s", toXC(zone.left, zone.top), toXC(zone.right, zone.bottom)));
                }
                // if the formula definition could have accepted a range, we would pass through the _range function and not here
                if (zone.bottom !== zone.top || zone.left !== zone.right) {
                    throw new Error(_lt("Function %s expects the parameter %s to be a single value or a single cell reference, not a range.", functionName.toString(), paramNumber.toString()));
                }
                //it's a cell
                return readCell(reference, referenceSheetId);
            }
            /**
             * Return the values of the cell(s) used in reference, but always in the format of a range even
             * if a single cell is referenced. This is useful for the formulas that describe parameters as
             * range<number> etc.
             *
             * the parameters are the same as refFn, except that these parameters cannot be Meta
             */
            function range(position, references, sheetId) {
                const referenceText = references[position];
                const [reference, sheetName] = referenceText.split("!").reverse();
                const referenceSheetId = sheetName
                    ? evalContext.getters.getSheetIdByName(sheetName)
                    : sheetId;
                if (references[position] && !references[position].includes(":")) {
                    //it's a cell reference, but it must be treated as a range
                    return _range(reference, reference, referenceSheetId);
                }
                else {
                    const [left, right] = reference.split(":");
                    return _range(left, right, referenceSheetId);
                }
            }
            return [refFn, range, evalContext];
        }
    }
    EvaluationPlugin.getters = ["evaluateFormula", "isIdle"];
    EvaluationPlugin.modes = ["normal", "readonly"];

    class FigurePlugin extends BasePlugin {
        constructor() {
            super(...arguments);
            this.selectedFigureId = null;
            this.figures = {};
            this.sheetFigures = {};
        }
        // ---------------------------------------------------------------------------
        // Command Handling
        // ---------------------------------------------------------------------------
        handle(cmd) {
            switch (cmd.type) {
                case "DELETE_SHEET":
                    this.deleteSheet(cmd.sheet);
                    break;
                case "CREATE_FIGURE":
                    this.history.updateLocalState(["figures", cmd.figure.id], cmd.figure);
                    const sheetFigures = (this.sheetFigures[cmd.sheet] || []).slice();
                    sheetFigures.push(cmd.figure);
                    this.history.updateLocalState(["sheetFigures", cmd.sheet], sheetFigures);
                    break;
                case "UPDATE_FIGURE":
                    if (cmd.x !== undefined) {
                        this.history.updateLocalState(["figures", cmd.id, "x"], Math.max(cmd.x, 0));
                    }
                    if (cmd.y !== undefined) {
                        this.history.updateLocalState(["figures", cmd.id, "y"], Math.max(cmd.y, 0));
                    }
                    if (cmd.width !== undefined) {
                        this.history.updateLocalState(["figures", cmd.id, "width"], cmd.width);
                    }
                    if (cmd.height !== undefined) {
                        this.history.updateLocalState(["figures", cmd.id, "height"], cmd.height);
                    }
                    if (cmd.data !== undefined) {
                        this.history.updateLocalState(["figures", cmd.id, "data"], cmd.data);
                    }
                    break;
                case "SELECT_FIGURE":
                    this.selectedFigureId = cmd.id;
                    break;
                case "DELETE_FIGURE":
                    this.history.updateLocalState(["figures", cmd.id], undefined);
                    for (let s in this.sheetFigures) {
                        let deletedFigureIndex = this.sheetFigures[s].findIndex((f) => f.id === cmd.id);
                        if (deletedFigureIndex > -1) {
                            const copy = this.sheetFigures[s].slice();
                            copy.splice(deletedFigureIndex, 1);
                            this.history.updateLocalState(["sheetFigures", s], copy);
                            this.selectedFigureId = null;
                        }
                    }
                    break;
                // some commands should not remove the current selection
                case "EVALUATE_CELLS":
                    break;
                default:
                    this.selectedFigureId = null;
            }
        }
        deleteSheet(sheet) {
            for (let figure of this.sheetFigures[sheet] || []) {
                this.history.updateLocalState(["figures", figure.id], undefined);
            }
            const sheetFigures = Object.assign({}, this.sheetFigures);
            delete sheetFigures[sheet];
            this.history.updateLocalState(["sheetFigures"], sheetFigures);
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        getFigures(viewport) {
            const result = [];
            const figures = this.sheetFigures[this.workbook.activeSheet.id] || [];
            const { offsetX, offsetY, width, height } = viewport;
            for (let figure of figures) {
                if (figure.x >= offsetX + width || figure.x + figure.width <= offsetX) {
                    continue;
                }
                if (figure.y >= offsetY + height || figure.y + figure.height <= offsetY) {
                    continue;
                }
                result.push(figure);
            }
            return result;
        }
        getSelectedFigureId() {
            return this.selectedFigureId;
        }
        getFigure(figureId) {
            return this.figures[figureId];
        }
        // ---------------------------------------------------------------------------
        // Import/Export
        // ---------------------------------------------------------------------------
        import(data) {
            for (let sheet of data.sheets) {
                const figList = [];
                for (let f of sheet.figures) {
                    this.figures[f.id] = f;
                    figList.push(f);
                }
                this.sheetFigures[sheet.id] = figList;
            }
        }
        export(data) {
            for (let sheetData of data.sheets) {
                sheetData.figures = this.sheetFigures[sheetData.id] || [];
            }
        }
    }
    FigurePlugin.getters = ["getFigures", "getSelectedFigureId", "getFigure"];

    // -----------------------------------------------------------------------------
    // Constants / Types / Helpers
    // -----------------------------------------------------------------------------
    const commandToSides = {
        top: ["top"],
        left: ["left"],
        right: ["right"],
        bottom: ["bottom"],
        all: ["top", "left", "bottom", "right"],
    };
    const DEFAULT_STYLE = {
        fillColor: "white",
        textColor: "black",
        fontSize: 11,
    };
    function getTargetZone(zone, side) {
        const { left, right, top, bottom } = zone;
        switch (side) {
            case "left":
                return { left, top, right: left, bottom };
            case "top":
                return { left, top, right, bottom: top };
            case "right":
                return { left: right, top, right, bottom };
            case "bottom":
                return { left, top: bottom, right, bottom };
        }
        return zone;
    }
    /**
     * Formatting plugin.
     *
     * This plugin manages all things related to a cell look:
     * - styles
     * - borders
     * - value formatters
     */
    class FormattingPlugin extends BasePlugin {
        constructor() {
            super(...arguments);
            this.ctx = document.createElement("canvas").getContext("2d");
            this.styles = {};
            this.borders = {};
            this.nextId = 1;
        }
        // ---------------------------------------------------------------------------
        // Command Handling
        // ---------------------------------------------------------------------------
        handle(cmd) {
            switch (cmd.type) {
                case "SET_FORMATTING":
                    if (cmd.style) {
                        this.setStyle(cmd.sheet, cmd.target, cmd.style);
                    }
                    if (cmd.border) {
                        this.setBorder(cmd.sheet, cmd.target, cmd.border);
                    }
                    break;
                case "CLEAR_FORMATTING":
                    this.clearFormatting(cmd.target);
                    break;
                case "SET_FORMATTER":
                    this.setFormatter(cmd.sheet, cmd.target, cmd.formatter);
                    break;
                case "SET_DECIMAL":
                    this.setDecimal(cmd.sheet, cmd.target, cmd.step);
                    break;
                case "ADD_COLUMNS":
                    const start_col = cmd.position === "before" ? cmd.column - 1 : cmd.column;
                    const end_col = start_col + cmd.quantity + 1;
                    this.onAddElements(start_col, end_col, true, cmd.position === "before");
                    break;
                case "ADD_ROWS":
                    const start_row = cmd.position === "before" ? cmd.row - 1 : cmd.row;
                    const end_row = start_row + cmd.quantity + 1;
                    this.onAddElements(start_row, end_row, false, cmd.position === "before");
                    break;
            }
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        getCellWidth(cell) {
            const styleId = cell.style || 0;
            const text = this.getters.getCellText(cell);
            return this.getTextWidth(text, styleId);
        }
        getTextWidth(text, styleId = 0) {
            const style = this.styles[styleId];
            const italic = style.italic ? "italic " : "";
            const weight = style.bold ? "bold" : DEFAULT_FONT_WEIGHT;
            const sizeInPt = style.fontSize || DEFAULT_FONT_SIZE;
            const size = fontSizeMap[sizeInPt];
            this.ctx.font = `${italic}${weight} ${size}px ${DEFAULT_FONT}`;
            return this.ctx.measureText(text).width;
        }
        getCellHeight(cell) {
            const style = this.styles[cell ? cell.style || 0 : 0];
            const sizeInPt = style.fontSize || DEFAULT_FONT_SIZE;
            return fontSizeMap[sizeInPt];
        }
        getCellStyle(cell) {
            return cell.style ? this.styles[cell.style] : {};
        }
        getCellBorder(cell) {
            return cell.border ? this.borders[cell.border] : null;
        }
        getCurrentStyle() {
            const cell = this.getters.getActiveCell();
            return cell && cell.style ? this.styles[cell.style] : {};
        }
        // ---------------------------------------------------------------------------
        // Styles
        // ---------------------------------------------------------------------------
        setStyle(sheet, target, style) {
            for (let zone of target) {
                for (let col = zone.left; col <= zone.right; col++) {
                    for (let row = zone.top; row <= zone.bottom; row++) {
                        this.setStyleToCell(col, row, style);
                    }
                }
            }
        }
        setStyleToCell(col, row, style) {
            const cell = this.getters.getCell(col, row);
            const currentStyle = cell && cell.style ? this.styles[cell.style] : {};
            const nextStyle = Object.assign({}, currentStyle, style);
            const id = this.registerStyle(nextStyle);
            this.dispatch("UPDATE_CELL", {
                sheet: this.workbook.activeSheet.id,
                col,
                row,
                style: id,
            });
        }
        registerStyle(style) {
            const strStyle = stringify(style);
            for (let k in this.styles) {
                if (stringify(this.styles[k]) === strStyle) {
                    return parseInt(k, 10);
                }
            }
            const id = this.nextId++;
            this.styles[id] = style;
            return id;
        }
        // ---------------------------------------------------------------------------
        // Borders
        // ---------------------------------------------------------------------------
        setBorder(sheet, zones, command) {
            // this object aggregate the desired final border command for a cell
            const borderMap = {};
            for (let zone of zones) {
                this.aggregateBorderCommands(sheet, zone, command, borderMap);
            }
            for (let [xc, borderId] of Object.entries(borderMap)) {
                const [col, row] = toCartesian(xc);
                const cell = this.getters.getCell(col, row);
                const current = (cell && cell.border) || 0;
                if (current !== borderId) {
                    this.dispatch("UPDATE_CELL", {
                        sheet: sheet,
                        col,
                        row,
                        border: borderId,
                    });
                }
            }
        }
        aggregateBorderCommands(sheet, zone, command, borderMap) {
            if (command === "clear") {
                for (let row = zone.top; row <= zone.bottom; row++) {
                    for (let col = zone.left; col <= zone.right; col++) {
                        this.clearBorder(sheet, col, row, borderMap);
                    }
                }
                return;
            }
            if (command === "external") {
                this.aggregateBorderCommands(sheet, zone, "left", borderMap);
                this.aggregateBorderCommands(sheet, zone, "right", borderMap);
                this.aggregateBorderCommands(sheet, zone, "top", borderMap);
                this.aggregateBorderCommands(sheet, zone, "bottom", borderMap);
                return;
            }
            if (command === "hv") {
                this.aggregateBorderCommands(sheet, zone, "h", borderMap);
                this.aggregateBorderCommands(sheet, zone, "v", borderMap);
                return;
            }
            const { left, top, right, bottom } = zone;
            if (command === "h") {
                for (let r = top + 1; r <= bottom; r++) {
                    this.aggregateBorderCommands(sheet, { left, top: r, right, bottom: r }, "top", borderMap);
                }
                return;
            }
            if (command === "v") {
                for (let c = left + 1; c <= right; c++) {
                    this.aggregateBorderCommands(sheet, { left: c, top, right: c, bottom }, "left", borderMap);
                }
                return;
            }
            const border = {};
            for (let side of commandToSides[command]) {
                border[side] = ["thin", "#000"];
            }
            const target = getTargetZone(zone, command);
            for (let row = target.top; row <= target.bottom; row++) {
                for (let col = target.left; col <= target.right; col++) {
                    this.setBorderToMap(sheet, col, row, border, borderMap);
                }
            }
        }
        clearBorder(sheet, col, row, borderMap) {
            const cell = this.getters.getCell(col, row);
            const xc = cell ? cell.xc : toXC(col, row);
            borderMap[xc] = 0;
            if (col > 0) {
                this.clearSide(sheet, col - 1, row, "right", borderMap);
            }
            if (row > 0) {
                this.clearSide(sheet, col, row - 1, "bottom", borderMap);
            }
            if (col < this.workbook.activeSheet.cols.length - 1) {
                this.clearSide(sheet, col + 1, row, "left", borderMap);
            }
            if (row < this.workbook.activeSheet.rows.length - 1) {
                this.clearSide(sheet, col, row + 1, "top", borderMap);
            }
        }
        clearSide(sheet, col, row, side, borderMap) {
            const cell = this.getters.getCell(col, row);
            const xc = cell ? cell.xc : toXC(col, row);
            const currentBorderId = xc in borderMap ? borderMap[xc] : cell && cell.border ? cell.border : 0;
            const currentBorder = this.borders[currentBorderId] || {};
            if (side in currentBorder) {
                const newBorder = Object.assign({}, currentBorder);
                delete newBorder[side];
                borderMap[xc] = this.registerBorder(newBorder);
            }
        }
        setBorderToMap(sheet, col, row, border, borderMap) {
            const cell = this.getters.getCell(col, row);
            const xc = cell ? cell.xc : toXC(col, row);
            const currentBorderId = xc in borderMap ? borderMap[xc] : cell && cell.border ? cell.border : 0;
            const currentBorder = this.borders[currentBorderId] || {};
            const nextBorder = Object.assign({}, currentBorder, border);
            const id = this.registerBorder(nextBorder);
            borderMap[xc] = id;
        }
        registerBorder(border) {
            if (!Object.keys(border).length) {
                return 0;
            }
            const strBorder = stringify(border);
            for (let k in this.borders) {
                if (stringify(this.borders[k]) === strBorder) {
                    return parseInt(k, 10);
                }
            }
            const id = this.nextId++;
            this.borders[id] = border;
            return id;
        }
        // ---------------------------------------------------------------------------
        // Clear formatting
        // ---------------------------------------------------------------------------
        /**
         * Note that here, formatting refers to styles+border, not value formatters
         */
        clearFormatting(zones) {
            for (let zone of zones) {
                for (let col = zone.left; col <= zone.right; col++) {
                    for (let row = zone.top; row <= zone.bottom; row++) {
                        this.dispatch("UPDATE_CELL", {
                            sheet: this.workbook.activeSheet.id,
                            col,
                            row,
                            style: 0,
                            border: 0,
                        });
                    }
                }
            }
        }
        // ---------------------------------------------------------------------------
        // Formatters
        // ---------------------------------------------------------------------------
        setFormatter(sheet, zones, format) {
            for (let zone of zones) {
                for (let row = zone.top; row <= zone.bottom; row++) {
                    for (let col = zone.left; col <= zone.right; col++) {
                        this.dispatch("UPDATE_CELL", {
                            sheet,
                            col,
                            row,
                            format,
                        });
                    }
                }
            }
        }
        /**
         * This function allows to adjust the quantity of decimal places after a decimal
         * point on cells containing number value. It does this by changing the cells
         * format. Values aren't modified.
         *
         * The change of the decimal quantity is done one by one, the sign of the step
         * variable indicates whether we are increasing or decreasing.
         *
         * If several cells are in the zone, the format resulting from the change of the
         * first cell (with number type) will be applied to the whole zone.
         */
        setDecimal(sheet, zones, step) {
            // Find the first cell with a number value and get the format
            const numberFormat = this.searchNumberFormat(zones);
            if (numberFormat !== undefined) {
                // Depending on the step sign, increase or decrease the decimal representation
                // of the format
                const newFormat = this.changeDecimalFormat(numberFormat, step);
                // Aply the new format on the whole zone
                this.setFormatter(sheet, zones, newFormat);
            }
        }
        /**
         * Take a range of cells and return the format of the first cell containing a
         * number value. Returns a default format if the cell hasn't format. Returns
         * undefined if no number value in the range.
         */
        searchNumberFormat(zones) {
            for (let zone of zones) {
                for (let row = zone.top; row <= zone.bottom; row++) {
                    for (let col = zone.left; col <= zone.right; col++) {
                        const cell = this.getters.getCell(col, row);
                        if (cell &&
                            (cell.type === "number" || (cell.type === "formula" && typeof cell.value === "number"))) {
                            return cell.format || this.setDefaultNumberFormat(cell.value);
                        }
                    }
                }
            }
            return undefined;
        }
        /**
         * Function used to give the default format of a cell with a number for value.
         * It is considered that the default format of a number is 0 followed by as many
         * 0 as there are decimal places.
         *
         * Exemple:
         * - 1 --> '0'
         * - 123 --> '0'
         * - 12345 --> '0'
         * - 42.1 --> '0.0'
         * - 456.0001 --> '0.0000'
         */
        setDefaultNumberFormat(cellValue) {
            const strValue = cellValue.toString();
            const parts = strValue.split(".");
            if (parts.length === 1) {
                return "0";
            }
            return "0." + Array(parts[1].length + 1).join("0");
        }
        /**
         * This function take a cell format representation and return a new format representtion
         * with more or lesse decimal places.
         *
         * If the format doesn't look like a digital format (means that not contain '0')
         * or if this one cannot be increased or decreased, the returned format will be
         * the same.
         *
         * This function aims to work with all possible formats as well as custom formats.
         *
         * Examples of format changed by this function:
         * - "0" (step = 1) --> "0.0"
         * - "0.000%" (step = 1) --> "0.0000%"
         * - "0.00" (step = -1) --> "0.0"
         * - "0%" (step = -1) --> "0%"
         * - "#,##0.0" (step = -1) --> "#,##0"
         * - "#,##0;0.0%;0.000" (step = 1) --> "#,##0.0;0.00%;0.0000"
         */
        changeDecimalFormat(format, step) {
            const sign = Math.sign(step);
            // According to the representation of the cell format. A format can contain
            // up to 4 sub-formats which can be applied depending on the value of the cell
            // (among positive / negative / zero / text), each of these sub-format is separated
            // by ';' in the format. We need to make the change on each sub-format.
            const subFormats = format.split(";");
            let newSubFormats = [];
            for (let subFormat of subFormats) {
                const decimalPointPosition = subFormat.indexOf(".");
                const exponentPosition = subFormat.toUpperCase().indexOf("E");
                let newSubFormat;
                // the 1st step is to find the part of the zeros located before the
                // exponent (when existed)
                const subPart = exponentPosition > -1 ? subFormat.slice(0, exponentPosition) : subFormat;
                const zerosAfterDecimal = decimalPointPosition > -1 ? subPart.slice(decimalPointPosition).match(/0/g).length : 0;
                // the 2nd step is to add (or remove) zero after the last zeros obtained in
                // step 1
                const lastZeroPosition = subPart.lastIndexOf("0");
                if (lastZeroPosition > -1) {
                    if (sign > 0) {
                        // in this case we want to add decimal information
                        if (zerosAfterDecimal < maximumDecimalPlaces) {
                            newSubFormat =
                                subFormat.slice(0, lastZeroPosition + 1) +
                                    (zerosAfterDecimal === 0 ? ".0" : "0") +
                                    subFormat.slice(lastZeroPosition + 1);
                        }
                        else {
                            newSubFormat = subFormat;
                        }
                    }
                    else {
                        // in this case we want to remove decimal information
                        if (zerosAfterDecimal > 0) {
                            // remove last zero
                            newSubFormat =
                                subFormat.slice(0, lastZeroPosition) + subFormat.slice(lastZeroPosition + 1);
                            // if a zero always exist after decimal point else remove decimal point
                            if (zerosAfterDecimal === 1) {
                                newSubFormat =
                                    newSubFormat.slice(0, decimalPointPosition) +
                                        newSubFormat.slice(decimalPointPosition + 1);
                            }
                        }
                        else {
                            // zero after decimal isn't present, we can't remove zero
                            newSubFormat = subFormat;
                        }
                    }
                }
                else {
                    // no zeros are present in this format, we do nothing
                    newSubFormat = subFormat;
                }
                newSubFormats.push(newSubFormat);
            }
            return newSubFormats.join(";");
        }
        // ---------------------------------------------------------------------------
        // Grid Manipulation
        // ---------------------------------------------------------------------------
        /**
         * This function computes the style/border of a row/col based on the neighbours.
         *
         * @param index the index of the row/col of which we will change the style
         * @param isColumn true if element is a column, false if row
         * @param upper true if the style of the upper row/col should be used, false, if the lower should be used
         */
        onAddElements(start, end, isColumn, upper) {
            const length = isColumn
                ? this.workbook.activeSheet.rows.length
                : this.workbook.activeSheet.cols.length;
            const index = start + 1;
            for (let x = 0; x < length; x++) {
                const xc = isColumn ? toXC(index, x) : toXC(x, index);
                if (this.getters.isInMerge(xc)) {
                    continue;
                }
                const format = {};
                let lowerFormat = isColumn
                    ? this.getFormat(toXC(start, x))
                    : this.getFormat(toXC(x, start));
                let upperFormat = isColumn
                    ? this.getFormat(toXC(end, x))
                    : this.getFormat(toXC(x, end));
                if (upper) {
                    if (upperFormat.style) {
                        format["style"] = upperFormat.style;
                    }
                    if (upperFormat.format) {
                        format["format"] = upperFormat.format;
                    }
                }
                else {
                    if (lowerFormat.style) {
                        format["style"] = lowerFormat.style;
                    }
                    if (lowerFormat.format) {
                        format["format"] = lowerFormat.format;
                    }
                }
                if (upperFormat.border && upperFormat.border === lowerFormat.border) {
                    format["border"] = upperFormat.border;
                }
                if (Object.keys(format).length !== 0) {
                    for (let i = index; i < end; i++) {
                        this.dispatch("UPDATE_CELL", {
                            sheet: this.workbook.activeSheet.id,
                            col: isColumn ? i : x,
                            row: isColumn ? x : i,
                            style: format.style,
                            border: format.border,
                            format: format.format,
                        });
                    }
                }
            }
        }
        /**
         * gets the currently used style/border of a cell based on it's coordinates
         *
         * @param x column number of a cell
         * @param y row number of a cell
         */
        getFormat(xc) {
            const format = {};
            xc = this.getters.getMainCell(xc);
            if (xc in this.workbook.activeSheet.cells) {
                if (this.workbook.activeSheet.cells[xc].border) {
                    format["border"] = this.workbook.activeSheet.cells[xc].border;
                }
                if (this.workbook.activeSheet.cells[xc].style) {
                    format["style"] = this.workbook.activeSheet.cells[xc].style;
                }
                if (this.workbook.activeSheet.cells[xc].format) {
                    format["format"] = this.workbook.activeSheet.cells[xc].format;
                }
            }
            return format;
        }
        // ---------------------------------------------------------------------------
        // Import/Export
        // ---------------------------------------------------------------------------
        import(data) {
            if (data.styles) {
                this.styles = data.styles;
            }
            this.styles[0] = Object.assign({}, DEFAULT_STYLE, this.styles[0]);
            if (data.borders) {
                this.borders = data.borders;
            }
            let nextId = 1;
            for (let k in this.styles) {
                nextId = Math.max(k, nextId);
            }
            for (let k in this.borders) {
                nextId = Math.max(k, nextId);
            }
            this.nextId = nextId + 1;
        }
        export(data) {
            data.styles = this.styles;
            data.borders = this.borders;
        }
    }
    FormattingPlugin.getters = [
        "getCurrentStyle",
        "getCellWidth",
        "getTextWidth",
        "getCellHeight",
        "getCellStyle",
        "getCellBorder",
    ];

    /**
     * HighlightPlugin
     */
    class HighlightPlugin extends BasePlugin {
        constructor() {
            super(...arguments);
            this.highlights = [];
            this.color = "#000";
            this.highlightSelectionEnabled = false;
            this.pendingHighlights = [];
        }
        // ---------------------------------------------------------------------------
        // Command Handling
        // ---------------------------------------------------------------------------
        handle(cmd) {
            switch (cmd.type) {
                case "ADD_HIGHLIGHTS":
                    this.addHighlights(cmd.ranges);
                    break;
                case "REMOVE_ALL_HIGHLIGHTS":
                    this.highlights = [];
                    break;
                case "REMOVE_HIGHLIGHTS":
                    this.removeHighlights(cmd.ranges);
                    break;
                case "SELECT_CELL":
                case "SET_SELECTION":
                    if (this.highlightSelectionEnabled) {
                        this.highlightSelection();
                    }
                    break;
                case "START_SELECTION_EXPANSION":
                    this.color = getNextColor();
                    break;
                case "HIGHLIGHT_SELECTION":
                    this.highlightSelectionEnabled = cmd.enabled;
                    if (!cmd.enabled) {
                        this.dispatch("RESET_PENDING_HIGHLIGHT");
                    }
                    break;
                case "RESET_PENDING_HIGHLIGHT":
                    this.pendingHighlights = [];
                    break;
                case "ADD_PENDING_HIGHLIGHTS":
                    this.addPendingHighlight(cmd.ranges);
                    break;
                case "SET_HIGHLIGHT_COLOR":
                    this.color = cmd.color;
            }
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        getHighlights() {
            return this.highlights;
        }
        // ---------------------------------------------------------------------------
        // Other
        // ---------------------------------------------------------------------------
        addHighlights(ranges) {
            let highlights = this.prepareHighlights(ranges);
            this.highlights = this.highlights.concat(highlights);
        }
        addPendingHighlight(ranges) {
            let highlights = this.prepareHighlights(ranges);
            this.pendingHighlights = this.pendingHighlights.concat(highlights);
        }
        prepareHighlights(ranges) {
            if (Object.keys(ranges).length === 0) {
                return [];
            }
            return Object.keys(ranges)
                .map((r1c1) => {
                const [xc, sheet] = r1c1.split("!").reverse();
                const sheetId = sheet
                    ? this.getters.getSheetIdByName(sheet)
                    : this.getters.getActiveSheet();
                const zone = this.getters.expandZone(toZone(xc));
                return { zone, color: ranges[r1c1], sheet: sheetId };
            })
                .filter((x) => x.zone.top >= 0 &&
                x.zone.left >= 0 &&
                x.zone.bottom < this.workbook.activeSheet.rows.length &&
                x.zone.right < this.workbook.activeSheet.cols.length);
        }
        /**
         *
         * @param ranges {"[sheet!]XC": color}
         * @private
         */
        removeHighlights(ranges) {
            const activeSheetId = this.getters.getActiveSheet();
            const rangesBySheets = {};
            for (let [range, color] of Object.entries(ranges)) {
                const [xc, sheetName] = range.split("!").reverse();
                const sheetId = this.getters.getSheetIdByName(sheetName);
                rangesBySheets[sheetId || activeSheetId] = Object.assign({ [xc]: color }, rangesBySheets[sheetId || activeSheetId] || {});
            }
            const shouldBeKept = (highlight) => !(rangesBySheets[highlight.sheet] &&
                rangesBySheets[highlight.sheet][this.getters.zoneToXC(highlight.zone)] === highlight.color);
            this.highlights = this.highlights.filter(shouldBeKept);
        }
        /**
         * Highlight selected zones (which are not already highlighted).
         */
        highlightSelection() {
            this.removePendingHighlights();
            const zones = this.getters.getSelectedZones().filter((z) => !this.isHighlighted(z));
            const ranges = {};
            let color = this.color;
            for (const zone of zones) {
                ranges[this.getters.zoneToXC(zone)] = color;
                color = getNextColor();
            }
            this.dispatch("ADD_HIGHLIGHTS", { ranges });
            this.dispatch("ADD_PENDING_HIGHLIGHTS", { ranges });
        }
        isHighlighted(zone) {
            return !!this.highlights.find((h) => isEqual(h.zone, zone));
        }
        /**
         * Remove pending highlights which are not selected.
         * Highlighted zones which are selected are still considered
         * pending.
         */
        removePendingHighlights() {
            const ranges = {};
            const [selected, notSelected] = this.pendingHighlights.reduce(([y, n], highlight) => this.getters.isSelected(highlight.zone) ? [[...y, highlight], n] : [y, [...n, highlight]], [[], []]);
            for (const { zone, color } of notSelected) {
                ranges[this.getters.zoneToXC(zone)] = color;
            }
            this.dispatch("REMOVE_HIGHLIGHTS", { ranges });
            this.pendingHighlights = selected;
        }
        // ---------------------------------------------------------------------------
        // Grid rendering
        // ---------------------------------------------------------------------------
        drawGrid(renderingContext) {
            // rendering selection highlights
            const { ctx, viewport, thinLineWidth } = renderingContext;
            const sheetId = this.getters.getActiveSheet();
            const lineWidth = 3 * thinLineWidth;
            ctx.lineWidth = lineWidth;
            for (let h of this.highlights.filter((highlight) => highlight.sheet === sheetId)) {
                const [x, y, width, height] = this.getters.getRect(h.zone, viewport);
                if (width > 0 && height > 0) {
                    ctx.strokeStyle = h.color;
                    ctx.strokeRect(x + lineWidth / 2, y + lineWidth / 2, width - lineWidth, height - lineWidth);
                    ctx.globalCompositeOperation = "source-over";
                    ctx.fillStyle = h.color + "20";
                    ctx.fillRect(x + lineWidth, y + lineWidth, width - 2 * lineWidth, height - 2 * lineWidth);
                }
            }
        }
    }
    HighlightPlugin.modes = ["normal", "readonly"];
    HighlightPlugin.layers = [1 /* Highlights */];
    HighlightPlugin.getters = ["getHighlights"];

    class MergePlugin extends BasePlugin {
        constructor() {
            super(...arguments);
            this.nextId = 1;
            this.pending = null;
        }
        // ---------------------------------------------------------------------------
        // Command Handling
        // ---------------------------------------------------------------------------
        allowDispatch(cmd) {
            const force = "force" in cmd ? !!cmd.force : false;
            switch (cmd.type) {
                case "PASTE":
                    return this.isPasteAllowed(cmd.target, force);
                case "ADD_MERGE":
                    return this.isMergeAllowed(cmd.zone, force);
                default:
                    return { status: "SUCCESS" };
            }
        }
        beforeHandle(cmd) {
            switch (cmd.type) {
                case "REMOVE_COLUMNS":
                    this.exportAndRemoveMerges(cmd.sheet, (range) => updateRemoveColumns(range, cmd.columns), true);
                    break;
                case "REMOVE_ROWS":
                    this.exportAndRemoveMerges(cmd.sheet, (range) => updateRemoveRows(range, cmd.rows), false);
                    break;
                case "ADD_COLUMNS":
                    const col = cmd.position === "before" ? cmd.column : cmd.column + 1;
                    this.exportAndRemoveMerges(cmd.sheet, (range) => updateAddColumns(range, col, cmd.quantity), true);
                    break;
                case "ADD_ROWS":
                    const row = cmd.position === "before" ? cmd.row : cmd.row + 1;
                    this.exportAndRemoveMerges(cmd.sheet, (range) => updateAddRows(range, row, cmd.quantity), false);
                    break;
            }
        }
        handle(cmd) {
            switch (cmd.type) {
                case "ADD_MERGE":
                    if (cmd.interactive) {
                        this.interactiveMerge(cmd.sheet, cmd.zone);
                    }
                    else {
                        this.addMerge(cmd.sheet, cmd.zone);
                    }
                    break;
                case "REMOVE_MERGE":
                    this.removeMerge(cmd.sheet, cmd.zone);
                    break;
                case "AUTOFILL_CELL":
                    this.autoFillMerge(cmd.originCol, cmd.originRow, cmd.col, cmd.row);
                    break;
                case "PASTE_CELL":
                    const xc = toXC(cmd.originCol, cmd.originRow);
                    if (this.isMainCell(xc, cmd.sheet)) {
                        this.duplicateMerge(xc, cmd.col, cmd.row, cmd.sheet, cmd.cut);
                    }
                    break;
            }
            if (this.pending) {
                this.importMerges(this.pending.sheet, this.pending.merges);
                this.history.updateLocalState(["pending"], null);
            }
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        /**
         * Return true if the current selection requires losing state if it is merged.
         * This happens when there is some textual content in other cells than the
         * top left.
         */
        isMergeDestructive(zone) {
            const { left, right, top, bottom } = zone;
            for (let row = top; row <= bottom; row++) {
                const actualRow = this.workbook.activeSheet.rows[row];
                for (let col = left; col <= right; col++) {
                    if (col !== left || row !== top) {
                        const cell = actualRow.cells[col];
                        if (cell && cell.content) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }
        /**
         * Return true if the zone intersects an existing merge:
         * if they have at least a common cell
         */
        doesIntersectMerge(zone) {
            const { left, right, top, bottom } = zone;
            for (let row = top; row <= bottom; row++) {
                for (let col = left; col <= right; col++) {
                    const cellXc = toXC(col, row);
                    if (this.workbook.activeSheet.mergeCellMap[cellXc]) {
                        return true;
                    }
                }
            }
            return false;
        }
        /**
         * Add all necessary merge to the current selection to make it valid
         */
        expandZone(zone) {
            let { left, right, top, bottom } = zone;
            const sheet = this.workbook.activeSheet;
            let result = { left, right, top, bottom };
            for (let id in sheet.merges) {
                const merge = sheet.merges[id];
                if (overlap(merge, result)) {
                    result = union(merge, result);
                }
            }
            return isEqual(result, zone) ? result : this.expandZone(result);
        }
        isInMerge(xc) {
            return xc in this.workbook.activeSheet.mergeCellMap;
        }
        isMainCell(xc, sheetId) {
            const merges = this.workbook.sheets[sheetId].merges;
            for (let key in merges) {
                if (merges[key].topLeft === xc) {
                    return true;
                }
            }
            return false;
        }
        getMainCell(xc) {
            if (!this.isInMerge(xc)) {
                return xc;
            }
            const sheet = this.workbook.activeSheet;
            const merge = sheet.mergeCellMap[xc];
            return sheet.merges[merge].topLeft;
        }
        // ---------------------------------------------------------------------------
        // Merges
        // ---------------------------------------------------------------------------
        /**
         * Verify that we can merge without losing content of other cells or
         * because the user gave his permission
         */
        isMergeAllowed(zone, force) {
            if (!force) {
                if (this.isMergeDestructive(zone)) {
                    return {
                        status: "CANCELLED",
                        reason: 2 /* MergeIsDestructive */,
                    };
                }
            }
            return {
                status: "SUCCESS",
            };
        }
        /**
         * Merge the current selection. Note that:
         * - it assumes that we have a valid selection (no intersection with other
         *   merges)
         * - it does nothing if the merge is trivial: A1:A1
         */
        addMerge(sheetId, zone) {
            const sheet = this.workbook.sheets[sheetId];
            const { left, right, top, bottom } = zone;
            const tl = toXC(left, top);
            const br = toXC(right, bottom);
            if (tl === br) {
                return;
            }
            const topLeft = this.getters.getCell(left, top);
            let id = this.nextId++;
            this.history.updateState(["sheets", sheetId, "merges", id], {
                id,
                left,
                top,
                right,
                bottom,
                topLeft: tl,
            });
            let previousMerges = new Set();
            for (let row = top; row <= bottom; row++) {
                for (let col = left; col <= right; col++) {
                    const xc = toXC(col, row);
                    if (col !== left || row !== top) {
                        this.dispatch("UPDATE_CELL", {
                            sheet: sheetId,
                            col,
                            row,
                            style: topLeft ? topLeft.style : undefined,
                            content: undefined,
                        });
                    }
                    if (sheet.mergeCellMap[xc]) {
                        previousMerges.add(sheet.mergeCellMap[xc]);
                    }
                    this.history.updateState(["sheets", sheetId, "mergeCellMap", xc], id);
                }
            }
            this.applyBorderMerge(zone, sheetId);
            for (let m of previousMerges) {
                const { top, bottom, left, right } = sheet.merges[m];
                for (let r = top; r <= bottom; r++) {
                    for (let c = left; c <= right; c++) {
                        const xc = toXC(c, r);
                        if (sheet.mergeCellMap[xc] !== id) {
                            this.history.updateState(["sheets", sheetId, "mergeCellMap", xc], undefined);
                            this.dispatch("CLEAR_CELL", {
                                sheet: sheetId,
                                col: c,
                                row: r,
                            });
                        }
                    }
                }
                this.history.updateState(["sheets", sheetId, "merges", m], undefined);
            }
        }
        applyBorderMerge(zone, sheet) {
            const { left, right, top, bottom } = zone;
            const topLeft = this.getters.getCell(left, top);
            const bottomRight = this.getters.getCell(right, bottom) || topLeft;
            const bordersTopLeft = topLeft ? this.getters.getCellBorder(topLeft) : null;
            const bordersBottomRight = (bottomRight ? this.getters.getCellBorder(bottomRight) : null) || bordersTopLeft;
            this.dispatch("SET_FORMATTING", {
                sheet,
                target: [{ left, right, top, bottom }],
                border: "clear",
            });
            if (bordersBottomRight && bordersBottomRight.right) {
                const zone = [{ left: right, right, top, bottom }];
                this.dispatch("SET_FORMATTING", {
                    sheet,
                    target: zone,
                    border: "right",
                });
            }
            if (bordersTopLeft && bordersTopLeft.left) {
                const zone = [{ left, right: left, top, bottom }];
                this.dispatch("SET_FORMATTING", {
                    sheet,
                    target: zone,
                    border: "left",
                });
            }
            if (bordersTopLeft && bordersTopLeft.top) {
                const zone = [{ left, right, top, bottom: top }];
                this.dispatch("SET_FORMATTING", {
                    sheet,
                    target: zone,
                    border: "top",
                });
            }
            if (bordersBottomRight && bordersBottomRight.bottom) {
                const zone = [{ left, right, top: bottom, bottom }];
                this.dispatch("SET_FORMATTING", {
                    sheet,
                    target: zone,
                    border: "bottom",
                });
            }
        }
        removeMerge(sheetId, zone) {
            const { left, top, bottom, right } = zone;
            let tl = toXC(left, top);
            const mergeId = this.workbook.sheets[sheetId].mergeCellMap[tl];
            const mergeZone = this.workbook.sheets[sheetId].merges[mergeId];
            if (!isEqual(zone, mergeZone)) {
                throw new Error(_lt("Invalid merge zone"));
            }
            this.history.updateState(["sheets", sheetId, "merges", mergeId], undefined);
            for (let r = top; r <= bottom; r++) {
                for (let c = left; c <= right; c++) {
                    const xc = toXC(c, r);
                    this.history.updateState(["sheets", sheetId, "mergeCellMap", xc], undefined);
                }
            }
        }
        interactiveMerge(sheet, zone) {
            const result = this.dispatch("ADD_MERGE", { sheet, zone });
            if (result.status === "CANCELLED") {
                if (result.reason === 2 /* MergeIsDestructive */) {
                    this.ui.askConfirmation(_lt("Merging these cells will only preserve the top-leftmost value. Merge anyway?"), () => {
                        this.dispatch("ADD_MERGE", { sheet, zone, force: true });
                    });
                }
            }
        }
        duplicateMerge(xc, col, row, sheetId, cut) {
            const mergeId = this.workbook.sheets[sheetId].mergeCellMap[xc];
            const merge = this.workbook.sheets[sheetId].merges[mergeId];
            const colNumber = this.getters.getNumberCols(sheetId) - 1;
            const rowNumber = this.getters.getNumberRows(sheetId) - 1;
            const newMerge = {
                left: col,
                top: row,
                right: clip(col + merge.right - merge.left, 0, colNumber),
                bottom: clip(row + merge.bottom - merge.top, 0, rowNumber),
            };
            if (cut) {
                this.dispatch("REMOVE_MERGE", {
                    sheet: sheetId,
                    zone: merge,
                });
            }
            this.dispatch("ADD_MERGE", {
                sheet: this.workbook.activeSheet.id,
                zone: newMerge,
            });
        }
        // ---------------------------------------------------------------------------
        // Add/Remove columns
        // ---------------------------------------------------------------------------
        removeAllMerges(sheetId) {
            const sheet = this.workbook.sheets[sheetId];
            for (let id in sheet.merges) {
                this.history.updateState(["sheets", sheetId, "merges", id], undefined);
            }
            for (let id in sheet.mergeCellMap) {
                this.history.updateState(["sheets", sheetId, "mergeCellMap", id], undefined);
            }
        }
        exportAndRemoveMerges(sheetId, updater, isCol) {
            const sheet = this.workbook.sheets[sheetId];
            const merges = exportMerges(sheet.merges);
            const updatedMerges = [];
            for (let m of merges) {
                const update = updater(m);
                if (update) {
                    const [tl, br] = update.split(":");
                    if (tl !== br) {
                        updatedMerges.push(update);
                    }
                }
            }
            this.updateMergesStyles(sheetId, isCol);
            this.removeAllMerges(sheetId);
            this.history.updateLocalState(["pending"], { sheet: sheetId, merges: updatedMerges });
        }
        updateMergesStyles(sheetId, isColumn) {
            const sheet = this.workbook.sheets[sheetId];
            for (let merge of Object.values(sheet.merges)) {
                const xc = merge.topLeft;
                const topLeft = sheet.cells[xc];
                if (!topLeft) {
                    continue;
                }
                let [x, y] = toCartesian(xc);
                if (isColumn && merge.left !== merge.right) {
                    x += 1;
                }
                if (!isColumn && merge.top !== merge.bottom) {
                    y += 1;
                }
                this.dispatch("UPDATE_CELL", {
                    sheet: sheet.id,
                    col: x,
                    row: y,
                    style: topLeft.style,
                    border: topLeft.border,
                    format: topLeft.format,
                });
            }
        }
        // ---------------------------------------------------------------------------
        // Copy/Cut/Paste and Merge
        // ---------------------------------------------------------------------------
        isPasteAllowed(target, force) {
            if (!force) {
                const pasteZones = this.getters.getPasteZones(target);
                for (let zone of pasteZones) {
                    if (this.doesIntersectMerge(zone)) {
                        return {
                            status: "CANCELLED",
                            reason: 1 /* WillRemoveExistingMerge */,
                        };
                    }
                }
            }
            return {
                status: "SUCCESS",
            };
        }
        // ---------------------------------------------------------------------------
        // Autofill
        // ---------------------------------------------------------------------------
        autoFillMerge(originCol, originRow, col, row) {
            const xcOrigin = toXC(originCol, originRow);
            const xcTarget = toXC(col, row);
            const sheet = this.getters.getActiveSheet();
            if (this.isInMerge(xcTarget) && !this.isInMerge(xcOrigin)) {
                const mergeId = this.workbook.sheets[sheet].mergeCellMap[xcTarget];
                const zone = this.workbook.sheets[sheet].merges[mergeId];
                this.dispatch("REMOVE_MERGE", {
                    sheet,
                    zone,
                });
            }
            if (this.isMainCell(xcOrigin, sheet)) {
                this.duplicateMerge(xcOrigin, col, row, sheet);
            }
        }
        // ---------------------------------------------------------------------------
        // Import/Export
        // ---------------------------------------------------------------------------
        import(data) {
            const sheets = data.sheets || [];
            for (let sheetData of sheets) {
                const sheet = this.workbook.sheets[sheetData.id];
                if (sheet && sheetData.merges) {
                    this.importMerges(sheet.id, sheetData.merges);
                }
            }
        }
        importMerges(sheetId, merges) {
            for (let m of merges) {
                let id = this.nextId++;
                const [tl, br] = m.split(":");
                const [left, top] = toCartesian(tl);
                const [right, bottom] = toCartesian(br);
                this.history.updateState(["sheets", sheetId, "merges", id], {
                    id,
                    left,
                    top,
                    right,
                    bottom,
                    topLeft: tl,
                });
                for (let row = top; row <= bottom; row++) {
                    for (let col = left; col <= right; col++) {
                        const xc = toXC(col, row);
                        this.history.updateState(["sheets", sheetId, "mergeCellMap", xc], id);
                    }
                }
            }
        }
        export(data) {
            for (let sheetData of data.sheets) {
                const sheet = this.workbook.sheets[sheetData.id];
                sheetData.merges.push(...exportMerges(sheet.merges));
            }
        }
    }
    MergePlugin.getters = [
        "isMergeDestructive",
        "isInMerge",
        "getMainCell",
        "expandZone",
        "doesIntersectMerge",
    ];
    function exportMerges(merges) {
        return Object.values(merges).map((merge) => toXC(merge.left, merge.top) + ":" + toXC(merge.right, merge.bottom));
    }

    // -----------------------------------------------------------------------------
    // Constants, types, helpers, ...
    // -----------------------------------------------------------------------------
    function computeAlign(cell, isShowingFormulas) {
        if (cell.type === "formula" && isShowingFormulas) {
            return "left";
        }
        else if (cell.error || cell.pending) {
            return "center";
        }
        switch (typeof cell.value) {
            case "object":
            case "number":
                return "right";
            case "boolean":
                return "center";
            default:
                return "left";
        }
    }
    function searchIndex(headers, offset) {
        let left = 0;
        let right = headers.length - 1;
        while (left <= right) {
            const index = Math.floor((left + right) / 2);
            const header = headers[index];
            if (offset < header.start) {
                right = index - 1;
            }
            else if (offset > header.end) {
                left = index + 1;
            }
            else {
                return index;
            }
        }
        return -1;
    }
    class RendererPlugin extends BasePlugin {
        constructor() {
            super(...arguments);
            this.boxes = [];
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        /**
         * Return the index of a column given an offset x and a visible left col index.
         * It returns -1 if no column is found.
         */
        getColIndex(x, left) {
            if (x < HEADER_WIDTH) {
                return -1;
            }
            const cols = this.workbook.activeSheet.cols;
            const adjustedX = x - HEADER_WIDTH + cols[left].start + 1;
            return searchIndex(cols, adjustedX);
        }
        getRowIndex(y, top) {
            if (y < HEADER_HEIGHT) {
                return -1;
            }
            const rows = this.workbook.activeSheet.rows;
            const adjustedY = y - HEADER_HEIGHT + rows[top].start + 1;
            return searchIndex(rows, adjustedY);
        }
        getRect(zone, viewport) {
            const { left, top, right, bottom } = zone;
            let { offsetY, offsetX } = viewport;
            offsetX -= HEADER_WIDTH;
            offsetY -= HEADER_HEIGHT;
            const { cols, rows } = this.workbook.activeSheet;
            const x = Math.max(cols[left].start - offsetX, HEADER_WIDTH);
            const width = cols[right].end - offsetX - x;
            const y = Math.max(rows[top].start - offsetY, HEADER_HEIGHT);
            const height = rows[bottom].end - offsetY - y;
            return [x, y, width, height];
        }
        /**
         * Snap a viewport boundaries to exactly match the start of a cell.
         * @param viewport
         */
        snapViewportToCell(viewport) {
            const { cols, rows } = this.workbook.activeSheet;
            const adjustedViewport = Object.assign({}, viewport);
            adjustedViewport.offsetX = cols[viewport.left].start;
            adjustedViewport.offsetY = rows[viewport.top].start;
            return adjustedViewport;
        }
        /**
         * Adjust the viewport until the active cell is completely visible inside it.
         * @param viewport the viewport that will be adjusted
         */
        adjustViewportPosition(viewport) {
            const adjustedViewport = Object.assign({}, viewport);
            const { cols, rows } = this.workbook.activeSheet;
            const [col, row] = this.getters.getPosition();
            while (col >= adjustedViewport.right && col !== cols.length - 1) {
                adjustedViewport.offsetX = cols[adjustedViewport.left].end;
                this.adjustViewportZoneX(adjustedViewport);
            }
            while (col < adjustedViewport.left) {
                adjustedViewport.offsetX = cols[adjustedViewport.left - 1].start;
                this.adjustViewportZoneX(adjustedViewport);
            }
            while (row >= adjustedViewport.bottom && row !== rows.length - 1) {
                adjustedViewport.offsetY = rows[adjustedViewport.top].end;
                this.adjustViewportZoneY(adjustedViewport);
            }
            while (row < adjustedViewport.top) {
                adjustedViewport.offsetY = rows[adjustedViewport.top - 1].start;
                this.adjustViewportZoneY(adjustedViewport);
            }
            return adjustedViewport;
        }
        adjustViewportZone(viewport) {
            const adjustedViewport = Object.assign({}, viewport);
            this.adjustViewportZoneX(adjustedViewport);
            this.adjustViewportZoneY(adjustedViewport);
            return adjustedViewport;
        }
        adjustViewportZoneX(viewport) {
            const { cols } = this.workbook.activeSheet;
            const { width, offsetX } = viewport;
            viewport.left = this.getColIndex(offsetX + HEADER_WIDTH, 0);
            const x = width + offsetX - HEADER_WIDTH;
            viewport.right = cols.length - 1;
            for (let i = viewport.left; i < cols.length; i++) {
                if (x < cols[i].end) {
                    viewport.right = i;
                    break;
                }
            }
        }
        adjustViewportZoneY(viewport) {
            const { rows } = this.workbook.activeSheet;
            const { height, offsetY } = viewport;
            viewport.top = this.getRowIndex(offsetY + HEADER_HEIGHT, 0);
            let y = height + offsetY - HEADER_HEIGHT;
            viewport.bottom = rows.length - 1;
            for (let i = viewport.top; i < rows.length; i++) {
                if (y < rows[i].end) {
                    viewport.bottom = i;
                    break;
                }
            }
        }
        // ---------------------------------------------------------------------------
        // Grid rendering
        // ---------------------------------------------------------------------------
        drawGrid(renderingContext, layer) {
            switch (layer) {
                case 0 /* Background */:
                    this.boxes = this.getGridBoxes(renderingContext);
                    this.drawBackground(renderingContext);
                    this.drawCellBackground(renderingContext);
                    this.drawBorders(renderingContext);
                    this.drawTexts(renderingContext);
                    break;
                case 6 /* Headers */:
                    this.drawHeaders(renderingContext);
                    break;
            }
        }
        drawBackground(renderingContext) {
            const { ctx, viewport, thinLineWidth } = renderingContext;
            let { width, height, offsetX, offsetY, top, left, bottom, right } = viewport;
            const { rows, cols } = this.workbook.activeSheet;
            // white background
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, viewport.width, viewport.height);
            // background grid
            offsetX -= HEADER_WIDTH;
            offsetY -= HEADER_HEIGHT;
            ctx.lineWidth = 2 * thinLineWidth;
            ctx.strokeStyle = CELL_BORDER_COLOR;
            ctx.beginPath();
            // vertical lines
            const lineHeight = Math.min(height, rows[bottom].end - offsetY);
            for (let i = left; i <= right; i++) {
                const x = cols[i].end - offsetX;
                ctx.moveTo(x, 0);
                ctx.lineTo(x, lineHeight);
            }
            // horizontal lines
            const lineWidth = Math.min(width, cols[right].end - offsetX);
            for (let i = top; i <= bottom; i++) {
                const y = rows[i].end - offsetY;
                ctx.moveTo(0, y);
                ctx.lineTo(lineWidth, y);
            }
            ctx.stroke();
        }
        drawCellBackground(renderingContext) {
            const { ctx, thinLineWidth } = renderingContext;
            ctx.lineWidth = 0.3 * thinLineWidth;
            const inset = 0.1 * thinLineWidth;
            ctx.strokeStyle = "#111";
            for (let box of this.boxes) {
                // fill color
                let style = box.style;
                if (style && style.fillColor && style.fillColor !== "#ffffff") {
                    ctx.fillStyle = style.fillColor;
                    ctx.fillRect(box.x, box.y, box.width, box.height);
                    ctx.strokeRect(box.x + inset, box.y + inset, box.width - 2 * inset, box.height - 2 * inset);
                }
                if (box.error) {
                    ctx.fillStyle = "red";
                    ctx.beginPath();
                    ctx.moveTo(box.x + box.width - 5, box.y);
                    ctx.lineTo(box.x + box.width, box.y);
                    ctx.lineTo(box.x + box.width, box.y + 5);
                    ctx.fill();
                }
            }
        }
        drawBorders(renderingContext) {
            const { ctx, thinLineWidth } = renderingContext;
            for (let box of this.boxes) {
                // fill color
                let border = box.border;
                if (border) {
                    const { x, y, width, height } = box;
                    if (border.left) {
                        drawBorder(border.left, x, y, x, y + height);
                    }
                    if (border.top) {
                        drawBorder(border.top, x, y, x + width, y);
                    }
                    if (border.right) {
                        drawBorder(border.right, x + width, y, x + width, y + height);
                    }
                    if (border.bottom) {
                        drawBorder(border.bottom, x, y + height, x + width, y + height);
                    }
                }
            }
            function drawBorder([style, color], x1, y1, x2, y2) {
                ctx.strokeStyle = color;
                ctx.lineWidth = (style === "thin" ? 2 : 3) * thinLineWidth;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
        }
        drawTexts(renderingContext) {
            const { ctx, thinLineWidth } = renderingContext;
            ctx.textBaseline = "middle";
            let currentFont;
            for (let box of this.boxes) {
                if (box.text) {
                    const style = box.style || {};
                    const align = box.align;
                    const italic = style.italic ? "italic " : "";
                    const weight = style.bold ? "bold" : DEFAULT_FONT_WEIGHT;
                    const sizeInPt = style.fontSize || DEFAULT_FONT_SIZE;
                    const size = fontSizeMap[sizeInPt];
                    const font = `${italic}${weight} ${size}px ${DEFAULT_FONT}`;
                    if (font !== currentFont) {
                        currentFont = font;
                        ctx.font = font;
                    }
                    ctx.fillStyle = style.textColor || "#000";
                    let x;
                    let y = box.y + box.height / 2 + 1;
                    if (align === "left") {
                        x = box.x + 3;
                    }
                    else if (align === "right") {
                        x = box.x + box.width - 3;
                    }
                    else {
                        x = box.x + box.width / 2;
                    }
                    ctx.textAlign = align;
                    if (box.clipRect) {
                        ctx.save();
                        ctx.beginPath();
                        ctx.rect(...box.clipRect);
                        ctx.clip();
                    }
                    ctx.fillText(box.text, Math.round(x), Math.round(y));
                    if (style.strikethrough) {
                        if (align === "right") {
                            x = x - box.textWidth;
                        }
                        else if (align === "center") {
                            x = x - box.textWidth / 2;
                        }
                        ctx.fillRect(x, y, box.textWidth, 2.6 * thinLineWidth);
                    }
                    if (box.clipRect) {
                        ctx.restore();
                    }
                }
            }
        }
        drawHeaders(renderingContext) {
            const { ctx, viewport, thinLineWidth } = renderingContext;
            let { width, height, offsetX, offsetY, left, top, right, bottom } = viewport;
            offsetX -= HEADER_WIDTH;
            offsetY -= HEADER_HEIGHT;
            const selection = this.getters.getSelectedZones();
            const { cols, rows } = this.workbook.activeSheet;
            const activeCols = this.getters.getActiveCols();
            const activeRows = this.getters.getActiveRows();
            ctx.fillStyle = BACKGROUND_HEADER_COLOR;
            ctx.font = `400 ${HEADER_FONT_SIZE}px ${DEFAULT_FONT}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.lineWidth = thinLineWidth;
            ctx.strokeStyle = "#333";
            // background
            ctx.fillRect(0, 0, width, HEADER_HEIGHT);
            ctx.fillRect(0, 0, HEADER_WIDTH, height);
            // selection background
            ctx.fillStyle = BACKGROUND_HEADER_SELECTED_COLOR;
            for (let zone of selection) {
                const x1 = Math.max(HEADER_WIDTH, cols[zone.left].start - offsetX);
                const x2 = Math.max(HEADER_WIDTH, cols[zone.right].end - offsetX);
                const y1 = Math.max(HEADER_HEIGHT, rows[zone.top].start - offsetY);
                const y2 = Math.max(HEADER_HEIGHT, rows[zone.bottom].end - offsetY);
                ctx.fillStyle = activeCols.has(zone.left)
                    ? BACKGROUND_HEADER_ACTIVE_COLOR
                    : BACKGROUND_HEADER_SELECTED_COLOR;
                ctx.fillRect(x1, 0, x2 - x1, HEADER_HEIGHT);
                ctx.fillStyle = activeRows.has(zone.top)
                    ? BACKGROUND_HEADER_ACTIVE_COLOR
                    : BACKGROUND_HEADER_SELECTED_COLOR;
                ctx.fillRect(0, y1, HEADER_WIDTH, y2 - y1);
            }
            // 2 main lines
            ctx.beginPath();
            ctx.moveTo(HEADER_WIDTH, 0);
            ctx.lineTo(HEADER_WIDTH, height);
            ctx.moveTo(0, HEADER_HEIGHT);
            ctx.lineTo(width, HEADER_HEIGHT);
            ctx.strokeStyle = HEADER_BORDER_COLOR;
            ctx.stroke();
            ctx.beginPath();
            // column text + separator
            for (let i = left; i <= right; i++) {
                const col = cols[i];
                ctx.fillStyle = activeCols.has(i) ? "#fff" : TEXT_HEADER_COLOR;
                ctx.fillText(col.name, (col.start + col.end) / 2 - offsetX, HEADER_HEIGHT / 2);
                ctx.moveTo(col.end - offsetX, 0);
                ctx.lineTo(col.end - offsetX, HEADER_HEIGHT);
            }
            // row text + separator
            for (let i = top; i <= bottom; i++) {
                const row = rows[i];
                ctx.fillStyle = activeRows.has(i) ? "#fff" : TEXT_HEADER_COLOR;
                ctx.fillText(row.name, HEADER_WIDTH / 2, (row.start + row.end) / 2 - offsetY);
                ctx.moveTo(0, row.end - offsetY);
                ctx.lineTo(HEADER_WIDTH, row.end - offsetY);
            }
            ctx.stroke();
        }
        hasContent(col, row) {
            const { cells, mergeCellMap } = this.workbook.activeSheet;
            const xc = toXC(col, row);
            const cell = cells[xc];
            return (cell && cell.content) || (xc in mergeCellMap);
        }
        getGridBoxes(renderingContext) {
            const { viewport } = renderingContext;
            let { right, left, top, bottom, offsetX, offsetY } = viewport;
            offsetX -= HEADER_WIDTH;
            offsetY -= HEADER_HEIGHT;
            const result = [];
            const { cols, rows, mergeCellMap, cells, merges } = this.workbook.activeSheet;
            // process all visible cells
            for (let rowNumber = top; rowNumber <= bottom; rowNumber++) {
                let row = rows[rowNumber];
                for (let colNumber = left; colNumber <= right; colNumber++) {
                    let cell = row.cells[colNumber];
                    if (cell && !(cell.xc in mergeCellMap)) {
                        let col = cols[colNumber];
                        const text = this.getters.getCellText(cell);
                        const textWidth = this.getters.getCellWidth(cell);
                        let style = this.getters.getCellStyle(cell);
                        const conditionalStyle = this.getters.getConditionalStyle(cell.xc);
                        if (conditionalStyle) {
                            style = Object.assign({}, style, conditionalStyle);
                        }
                        const align = text
                            ? (style && style.align) || computeAlign(cell, this.getters.shouldShowFormulas())
                            : undefined;
                        let clipRect = null;
                        if (text && textWidth > cols[cell.col].size) {
                            let c;
                            let width;
                            switch (align) {
                                case "left":
                                    c = cell.col;
                                    while (c < right && !this.hasContent(c + 1, cell.row)) {
                                        c++;
                                    }
                                    width = cols[c].end - col.start;
                                    if (width < textWidth) {
                                        clipRect = [col.start - offsetX, row.start - offsetY, width, row.size];
                                    }
                                    break;
                                case "right":
                                    c = cell.col;
                                    while (c > left && !this.hasContent(c - 1, cell.row)) {
                                        c--;
                                    }
                                    width = col.end - cols[c].start;
                                    if (width < textWidth) {
                                        clipRect = [cols[c].start - offsetX, row.start - offsetY, width, row.size];
                                    }
                                    break;
                                case "center":
                                    let c1 = colNumber;
                                    while (c1 > left && !this.hasContent(c1 - 1, rowNumber)) {
                                        c1--;
                                    }
                                    let c2 = colNumber;
                                    while (c2 < right && !this.hasContent(c2 + 1, rowNumber)) {
                                        c2++;
                                    }
                                    const colLeft = Math.min(c1, colNumber);
                                    const colRight = Math.max(c2, colNumber);
                                    width = cols[colRight].end - cols[colLeft].start;
                                    if (width < textWidth || colLeft === colNumber || colRight === colNumber) {
                                        clipRect = [cols[colLeft].start - offsetX, row.start - offsetY, width, row.size];
                                    }
                                    break;
                            }
                        }
                        result.push({
                            x: col.start - offsetX,
                            y: row.start - offsetY,
                            width: col.size,
                            height: row.size,
                            text,
                            textWidth,
                            border: this.getters.getCellBorder(cell),
                            style,
                            align,
                            clipRect,
                            error: cell.error,
                        });
                    }
                }
            }
            // process all visible merges
            for (let id in merges) {
                let merge = merges[id];
                if (overlap(merge, viewport)) {
                    const refCell = cells[merge.topLeft];
                    const bottomRight = cells[toXC(merge.right, merge.bottom)];
                    const width = cols[merge.right].end - cols[merge.left].start;
                    let text, textWidth, style, align, border;
                    if (refCell || bottomRight) {
                        text = refCell ? this.getters.getCellText(refCell) : "";
                        textWidth = refCell ? this.getters.getCellWidth(refCell) : null;
                        const cfStyle = this.getters.getConditionalStyle(merge.topLeft);
                        style = cfStyle ? cfStyle : refCell ? this.getters.getCellStyle(refCell) : null;
                        align = text
                            ? (style && style.align) || computeAlign(refCell, this.getters.shouldShowFormulas())
                            : null;
                        const borderTopLeft = refCell ? this.getters.getCellBorder(refCell) : null;
                        const borderBottomRight = bottomRight ? this.getters.getCellBorder(bottomRight) : null;
                        border = {
                            bottom: borderBottomRight ? borderBottomRight.bottom : null,
                            left: borderTopLeft ? borderTopLeft.left : null,
                            right: borderBottomRight ? borderBottomRight.right : null,
                            top: borderTopLeft ? borderTopLeft.top : null,
                        };
                    }
                    style = style || {};
                    // Small trick: the code that draw the background color skips the color
                    // #ffffff.  But for merges, we actually need to draw the background,
                    // otherwise the grid is visible. So, we change the #ffffff color to the
                    // color #fff, which is actually the same.
                    if (!style.fillColor || style.fillColor === "#ffffff") {
                        style = Object.create(style);
                        style.fillColor = "#fff";
                    }
                    const x = cols[merge.left].start - offsetX;
                    const y = rows[merge.top].start - offsetY;
                    const height = rows[merge.bottom].end - rows[merge.top].start;
                    result.push({
                        x: x,
                        y: y,
                        width,
                        height,
                        text,
                        textWidth,
                        border,
                        style,
                        align,
                        clipRect: [x, y, width, height],
                        error: refCell ? refCell.error : undefined,
                    });
                }
            }
            return result;
        }
    }
    RendererPlugin.layers = [0 /* Background */, 6 /* Headers */];
    RendererPlugin.getters = [
        "getColIndex",
        "getRowIndex",
        "getRect",
        "snapViewportToCell",
        "adjustViewportPosition",
        "adjustViewportZone",
    ];
    RendererPlugin.modes = ["normal", "readonly"];

    var SelectionMode;
    (function (SelectionMode) {
        SelectionMode[SelectionMode["idle"] = 0] = "idle";
        SelectionMode[SelectionMode["selecting"] = 1] = "selecting";
        SelectionMode[SelectionMode["readyToExpand"] = 2] = "readyToExpand";
        SelectionMode[SelectionMode["expanding"] = 3] = "expanding";
    })(SelectionMode || (SelectionMode = {}));
    /**
     * SelectionPlugin
     */
    class SelectionPlugin extends BasePlugin {
        constructor() {
            super(...arguments);
            this.selection = {
                zones: [{ top: 0, left: 0, bottom: 0, right: 0 }],
                anchor: [0, 0],
            };
            this.activeCol = 0;
            this.activeRow = 0;
            this.activeXc = "A1";
            this.mode = SelectionMode.idle;
            this.sheetsData = {};
        }
        // ---------------------------------------------------------------------------
        // Command Handling
        // ---------------------------------------------------------------------------
        allowDispatch(cmd) {
            switch (cmd.type) {
                case "MOVE_POSITION": {
                    const [refCol, refRow] = this.getReferenceCoords();
                    const { cols, rows } = this.workbook.activeSheet;
                    const outOfBound = (cmd.deltaY < 0 && refRow === 0) ||
                        (cmd.deltaY > 0 && refRow === rows.length - 1) ||
                        (cmd.deltaX < 0 && refCol === 0) ||
                        (cmd.deltaX > 0 && refCol === cols.length - 1);
                    if (outOfBound) {
                        return {
                            status: "CANCELLED",
                            reason: 10 /* SelectionOutOfBound */,
                        };
                    }
                    break;
                }
                case "SELECT_COLUMN": {
                    const { index } = cmd;
                    if (index < 0 || index >= this.workbook.activeSheet.cols.length) {
                        return {
                            status: "CANCELLED",
                            reason: 10 /* SelectionOutOfBound */,
                        };
                    }
                    break;
                }
                case "SELECT_ROW": {
                    const { index } = cmd;
                    if (index < 0 || index >= this.workbook.activeSheet.rows.length) {
                        return {
                            status: "CANCELLED",
                            reason: 10 /* SelectionOutOfBound */,
                        };
                    }
                    break;
                }
            }
            return {
                status: "SUCCESS",
            };
        }
        handle(cmd) {
            switch (cmd.type) {
                case "START":
                    this.selectCell(0, 0);
                    break;
                case "ACTIVATE_SHEET":
                    this.sheetsData[cmd.from] = {
                        selection: JSON.parse(JSON.stringify(this.selection)),
                        activeCol: this.activeCol,
                        activeRow: this.activeRow,
                        activeXc: this.activeXc,
                    };
                    if (cmd.to in this.sheetsData) {
                        Object.assign(this, this.sheetsData[cmd.to]);
                    }
                    else {
                        this.selectCell(0, 0);
                    }
                    break;
                case "SET_SELECTION":
                    this.setSelection(cmd.anchor, cmd.zones, cmd.strict);
                    break;
                case "START_SELECTION":
                    this.mode = SelectionMode.selecting;
                    break;
                case "PREPARE_SELECTION_EXPANSION":
                    this.mode = SelectionMode.readyToExpand;
                    break;
                case "START_SELECTION_EXPANSION":
                    this.mode = SelectionMode.expanding;
                    break;
                case "STOP_SELECTION":
                    this.mode = SelectionMode.idle;
                    break;
                case "MOVE_POSITION":
                    this.movePosition(cmd.deltaX, cmd.deltaY);
                    break;
                case "SELECT_CELL":
                    this.selectCell(cmd.col, cmd.row);
                    break;
                case "SELECT_COLUMN":
                    this.selectColumn(cmd.index, cmd.createRange || false, cmd.updateRange || false);
                    break;
                case "SELECT_ROW":
                    this.selectRow(cmd.index, cmd.createRange || false, cmd.updateRange || false);
                    break;
                case "SELECT_ALL":
                    this.selectAll();
                    break;
                case "ALTER_SELECTION":
                    if (cmd.delta) {
                        this.moveSelection(cmd.delta[0], cmd.delta[1]);
                    }
                    if (cmd.cell) {
                        this.addCellToSelection(...cmd.cell);
                    }
                    break;
                case "UNDO":
                case "REDO":
                case "REMOVE_COLUMNS":
                case "REMOVE_ROWS":
                    this.ensureSelectionValidity();
                    break;
                case "ADD_COLUMNS":
                    if (cmd.position === "before") {
                        this.onAddColumns(cmd.quantity);
                    }
                    break;
                case "ADD_ROWS":
                    if (cmd.position === "before") {
                        this.onAddRows(cmd.quantity);
                    }
                    break;
            }
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        getActiveCell() {
            const sheet = this.workbook.activeSheet;
            let mergeId = sheet.mergeCellMap[this.activeXc];
            if (mergeId) {
                return sheet.cells[sheet.merges[mergeId].topLeft];
            }
            else {
                return this.getters.getCell(this.activeCol, this.activeRow);
            }
        }
        getActiveCols() {
            const activeCols = new Set();
            for (let zone of this.selection.zones) {
                if (zone.top === 0 && zone.bottom === this.workbook.activeSheet.rows.length - 1) {
                    for (let i = zone.left; i <= zone.right; i++) {
                        activeCols.add(i);
                    }
                }
            }
            return activeCols;
        }
        getActiveRows() {
            const activeRows = new Set();
            for (let zone of this.selection.zones) {
                if (zone.left === 0 && zone.right === this.workbook.activeSheet.cols.length - 1) {
                    for (let i = zone.top; i <= zone.bottom; i++) {
                        activeRows.add(i);
                    }
                }
            }
            return activeRows;
        }
        getSelectedZones() {
            return this.selection.zones;
        }
        getSelectedZone() {
            return this.selection.zones[this.selection.zones.length - 1];
        }
        getSelection() {
            return this.selection;
        }
        getPosition() {
            return [this.activeCol, this.activeRow];
        }
        getAggregate() {
            let aggregate = 0;
            let n = 0;
            for (let zone of this.selection.zones) {
                for (let row = zone.top; row <= zone.bottom; row++) {
                    const r = this.workbook.activeSheet.rows[row];
                    for (let col = zone.left; col <= zone.right; col++) {
                        const cell = r.cells[col];
                        if (cell && cell.type !== "text" && !cell.error && typeof cell.value === "number") {
                            n++;
                            aggregate += cell.value;
                        }
                    }
                }
            }
            return n < 2 ? null : formatStandardNumber(aggregate);
        }
        getSelectionMode() {
            return this.mode;
        }
        isSelected(zone) {
            return !!this.getters.getSelectedZones().find((z) => isEqual(z, zone));
        }
        // ---------------------------------------------------------------------------
        // Other
        // ---------------------------------------------------------------------------
        /**
         * Return [col, row]
         */
        getReferenceCoords() {
            const isSelectingRange = this.getters.getEditionMode() === "selecting";
            return isSelectingRange ? this.selection.anchor : [this.activeCol, this.activeRow];
        }
        selectColumn(index, createRange, updateRange) {
            const bottom = this.workbook.activeSheet.rows.length - 1;
            const zone = { left: index, right: index, top: 0, bottom };
            const current = this.selection.zones;
            let zones, anchor;
            if (updateRange) {
                const [col, row] = this.selection.anchor;
                const updatedZone = union(zone, { left: col, right: col, top: 0, bottom });
                zones = current.slice(0, -1).concat(updatedZone);
                anchor = [col, row];
            }
            else {
                zones = createRange ? current.concat(zone) : [zone];
                anchor = [index, 0];
            }
            this.dispatch("SET_SELECTION", { zones, anchor, strict: true });
        }
        selectRow(index, createRange, updateRange) {
            const right = this.workbook.activeSheet.cols.length - 1;
            const zone = { top: index, bottom: index, left: 0, right };
            const current = this.selection.zones;
            let zones, anchor;
            if (updateRange) {
                const [col, row] = this.selection.anchor;
                const updatedZone = union(zone, { left: 0, right, top: row, bottom: row });
                zones = current.slice(0, -1).concat(updatedZone);
                anchor = [col, row];
            }
            else {
                zones = createRange ? current.concat(zone) : [zone];
                anchor = [0, index];
            }
            this.dispatch("SET_SELECTION", { zones, anchor, strict: true });
        }
        selectAll() {
            const bottom = this.workbook.activeSheet.rows.length - 1;
            const right = this.workbook.activeSheet.cols.length - 1;
            const zone = { left: 0, top: 0, bottom, right };
            this.dispatch("SET_SELECTION", { zones: [zone], anchor: [0, 0] });
        }
        /**
         * Change the anchor of the selection active cell to an absolute col and row inded.
         *
         * This is a non trivial task. We need to stop the editing process and update
         * properly the current selection.  Also, this method can optionally create a new
         * range in the selection.
         */
        selectCell(col, row) {
            const xc = toXC(col, row);
            let zone = this.getters.expandZone({ left: col, right: col, top: row, bottom: row });
            if (this.mode === SelectionMode.expanding) {
                this.selection.zones.push(zone);
            }
            else {
                this.selection.zones = [zone];
            }
            this.selection.anchor = [col, row];
            if (this.getters.getEditionMode() !== "selecting") {
                this.activeCol = col;
                this.activeRow = row;
                this.activeXc = xc;
            }
        }
        /**
         * Moves the position of either the active cell of the anchor of the current selection by a number of rows / cols delta
         */
        movePosition(deltaX, deltaY) {
            const [refCol, refRow] = this.getReferenceCoords();
            const activeReference = toXC(refCol, refRow);
            const sheet = this.workbook.activeSheet;
            let mergeId = sheet.mergeCellMap[activeReference];
            if (mergeId) {
                let targetCol = refCol;
                let targetRow = refRow;
                while (sheet.mergeCellMap[toXC(targetCol, targetRow)] === mergeId) {
                    targetCol += deltaX;
                    targetRow += deltaY;
                }
                if (targetCol >= 0 && targetRow >= 0) {
                    this.selectCell(targetCol, targetRow);
                }
            }
            else {
                this.selectCell(refCol + deltaX, refRow + deltaY);
            }
        }
        setSelection(anchor, zones, strict = false) {
            this.selectCell(...anchor);
            if (strict) {
                this.selection.zones = zones;
            }
            else {
                this.selection.zones = zones.map(this.getters.expandZone);
            }
            this.selection.anchor = anchor;
        }
        moveSelection(deltaX, deltaY) {
            const selection = this.selection;
            const zones = selection.zones.slice();
            const lastZone = zones[selection.zones.length - 1];
            const [anchorCol, anchorRow] = selection.anchor;
            const { left, right, top, bottom } = lastZone;
            let result = lastZone;
            const expand = (z) => {
                const { left, right, top, bottom } = this.getters.expandZone(z);
                return {
                    left: Math.max(0, left),
                    right: Math.min(this.workbook.activeSheet.cols.length - 1, right),
                    top: Math.max(0, top),
                    bottom: Math.min(this.workbook.activeSheet.rows.length - 1, bottom),
                };
            };
            // check if we can shrink selection
            let n = 0;
            while (result !== null) {
                n++;
                if (deltaX < 0) {
                    result = anchorCol <= right - n ? expand({ top, left, bottom, right: right - n }) : null;
                }
                if (deltaX > 0) {
                    result = left + n <= anchorCol ? expand({ top, left: left + n, bottom, right }) : null;
                }
                if (deltaY < 0) {
                    result = anchorRow <= bottom - n ? expand({ top, left, bottom: bottom - n, right }) : null;
                }
                if (deltaY > 0) {
                    result = top + n <= anchorRow ? expand({ top: top + n, left, bottom, right }) : null;
                }
                if (result && !isEqual(result, lastZone)) {
                    zones[zones.length - 1] = result;
                    this.dispatch("SET_SELECTION", { zones, anchor: [anchorCol, anchorRow] });
                    return;
                }
            }
            const currentZone = { top: anchorRow, bottom: anchorRow, left: anchorCol, right: anchorCol };
            const zoneWithDelta = {
                top: top + deltaY,
                left: left + deltaX,
                bottom: bottom + deltaY,
                right: right + deltaX,
            };
            result = expand(union(currentZone, zoneWithDelta));
            if (!isEqual(result, lastZone)) {
                zones[zones.length - 1] = result;
                this.dispatch("SET_SELECTION", { zones, anchor: [anchorCol, anchorRow] });
            }
        }
        addCellToSelection(col, row) {
            const selection = this.selection;
            const [anchorCol, anchorRow] = selection.anchor;
            const zone = {
                left: Math.min(anchorCol, col),
                top: Math.min(anchorRow, row),
                right: Math.max(anchorCol, col),
                bottom: Math.max(anchorRow, row),
            };
            const zones = selection.zones.slice(0, -1).concat(zone);
            this.dispatch("SET_SELECTION", { zones, anchor: [anchorCol, anchorRow] });
        }
        /**
         * Ensure selections are not outside sheet boundaries.
         * They are clipped to fit inside the sheet if needed.
         */
        ensureSelectionValidity() {
            const sheets = this.getters.getSheets();
            const sheetIds = sheets.map((sheet) => sheet.id);
            if (!sheetIds.includes(this.getters.getActiveSheet())) {
                this.dispatch("ACTIVATE_SHEET", { from: this.getters.getActiveSheet(), to: sheetIds[0] });
            }
            else {
                const { anchor, zones } = this.clipSelection(this.getters.getActiveSheet(), this.selection);
                this.setSelection(anchor, zones);
            }
            const deletedSheetIds = Object.keys(this.sheetsData).filter((sheetId) => !sheetIds.includes(sheetId));
            for (const sheetId of deletedSheetIds) {
                delete this.sheetsData[sheetId];
            }
            for (const sheetId in this.sheetsData) {
                const { anchor, zones } = this.clipSelection(sheetId, this.sheetsData[sheetId].selection);
                this.sheetsData[sheetId] = {
                    selection: { anchor, zones },
                    activeCol: anchor[0],
                    activeRow: anchor[1],
                    activeXc: toXC(...anchor),
                };
            }
        }
        /**
         * Clip the selection if it spans outside the sheet
         */
        clipSelection(sheetId, selection) {
            const cols = this.getters.getNumberCols(sheetId) - 1;
            const rows = this.getters.getNumberRows(sheetId) - 1;
            const zones = selection.zones.map((z) => ({
                left: clip(z.left, 0, cols),
                right: clip(z.right, 0, cols),
                top: clip(z.top, 0, rows),
                bottom: clip(z.bottom, 0, rows),
            }));
            const anchorCol = zones[zones.length - 1].left;
            const anchorRow = zones[zones.length - 1].top;
            return {
                anchor: [anchorCol, anchorRow],
                zones,
            };
        }
        onAddColumns(quantity) {
            const selection = this.getSelectedZone();
            const zone = {
                left: selection.left + quantity,
                right: selection.right + quantity,
                top: selection.top,
                bottom: selection.bottom,
            };
            this.dispatch("SET_SELECTION", { zones: [zone], anchor: [zone.left, zone.top], strict: true });
        }
        onAddRows(quantity) {
            const selection = this.getSelectedZone();
            const zone = {
                left: selection.left,
                right: selection.right,
                top: selection.top + quantity,
                bottom: selection.bottom + quantity,
            };
            this.dispatch("SET_SELECTION", { zones: [zone], anchor: [zone.left, zone.top], strict: true });
        }
        // ---------------------------------------------------------------------------
        // Grid rendering
        // ---------------------------------------------------------------------------
        drawGrid(renderingContext) {
            const { viewport, ctx, thinLineWidth } = renderingContext;
            // selection
            const zones = this.getSelectedZones();
            ctx.fillStyle = "#f3f7fe";
            const onlyOneCell = zones.length === 1 && zones[0].left === zones[0].right && zones[0].top === zones[0].bottom;
            ctx.fillStyle = onlyOneCell ? "#f3f7fe" : "#e9f0ff";
            ctx.strokeStyle = SELECTION_BORDER_COLOR;
            ctx.lineWidth = 1.5 * thinLineWidth;
            ctx.globalCompositeOperation = "multiply";
            for (const zone of zones) {
                const [x, y, width, height] = this.getters.getRect(zone, viewport);
                if (width > 0 && height > 0) {
                    ctx.fillRect(x, y, width, height);
                    ctx.strokeRect(x, y, width, height);
                }
            }
            ctx.globalCompositeOperation = "source-over";
            // active zone
            const { mergeCellMap, merges } = this.workbook.activeSheet;
            const [col, row] = this.getPosition();
            const activeXc = toXC(col, row);
            ctx.strokeStyle = "#3266ca";
            ctx.lineWidth = 3 * thinLineWidth;
            let zone;
            if (activeXc in mergeCellMap) {
                zone = merges[mergeCellMap[activeXc]];
            }
            else {
                zone = {
                    top: row,
                    bottom: row,
                    left: col,
                    right: col,
                };
            }
            const [x, y, width, height] = this.getters.getRect(zone, viewport);
            if (width > 0 && height > 0) {
                ctx.strokeRect(x, y, width, height);
            }
        }
    }
    SelectionPlugin.layers = [4 /* Selection */];
    SelectionPlugin.modes = ["normal", "readonly"];
    SelectionPlugin.getters = [
        "getActiveCell",
        "getActiveCols",
        "getActiveRows",
        "getSelectedZones",
        "getSelectedZone",
        "getAggregate",
        "getSelection",
        "getPosition",
        "getSelectionMode",
        "isSelected",
    ];

    /**
     * Selection input Plugin
     *
     * The SelectionInput component input and output are both arrays of strings, but
     * it requires an intermediary internal state to work.
     * This plugin handles this internal state.
     */
    class SelectionInputPlugin extends BasePlugin {
        constructor() {
            super(...arguments);
            this.inputs = {};
            this.inputMaximums = {};
            this.focusedInput = null;
            this.focusedRange = null;
            this.willAddNewRange = false;
        }
        // ---------------------------------------------------------------------------
        // Command Handling
        // ---------------------------------------------------------------------------
        allowDispatch(cmd) {
            switch (cmd.type) {
                case "FOCUS_RANGE":
                    const index = this.getIndex(cmd.id, cmd.rangeId);
                    if (this.focusedInput === cmd.id && this.focusedRange === index) {
                        return { status: "CANCELLED", reason: 14 /* InputAlreadyFocused */ };
                    }
                    break;
                case "ADD_EMPTY_RANGE":
                    if (this.inputs[cmd.id].length === this.inputMaximums[cmd.id]) {
                        return { status: "CANCELLED", reason: 15 /* MaximumRangesReached */ };
                    }
                    break;
            }
            return { status: "SUCCESS" };
        }
        handle(cmd) {
            switch (cmd.type) {
                case "ENABLE_NEW_SELECTION_INPUT":
                    this.initInput(cmd.id, cmd.initialRanges || [], cmd.maximumRanges);
                    break;
                case "DISABLE_SELECTION_INPUT":
                    if (this.focusedInput === cmd.id) {
                        this.dispatch("HIGHLIGHT_SELECTION", { enabled: false });
                        this.dispatch("REMOVE_ALL_HIGHLIGHTS");
                        this.focusedRange = null;
                        this.focusedInput = null;
                    }
                    delete this.inputs[cmd.id];
                    delete this.inputMaximums[cmd.id];
                    break;
                case "FOCUS_RANGE":
                    this.focus(cmd.id, this.getIndex(cmd.id, cmd.rangeId));
                    break;
                case "CHANGE_RANGE": {
                    const index = this.getIndex(cmd.id, cmd.rangeId);
                    if (index !== null) {
                        this.changeRange(cmd.id, index, cmd.value);
                    }
                    break;
                }
                case "ADD_EMPTY_RANGE":
                    this.inputs[cmd.id] = [...this.inputs[cmd.id], Object.freeze({ xc: "", id: uuidv4() })];
                    this.focusLast(cmd.id);
                    break;
                case "REMOVE_RANGE":
                    const index = this.getIndex(cmd.id, cmd.rangeId);
                    if (index !== null) {
                        this.removeRange(cmd.id, index);
                    }
                    break;
                case "ADD_HIGHLIGHTS":
                    const highlights = this.getters.getHighlights();
                    this.add(highlights.slice(highlights.length - Object.keys(cmd.ranges).length));
                    break;
                case "START_SELECTION_EXPANSION":
                    if (this.willAddNewRange) {
                        this.dispatch("RESET_PENDING_HIGHLIGHT");
                    }
                    break;
                case "PREPARE_SELECTION_EXPANSION": {
                    const [id, index] = [this.focusedInput, this.focusedRange];
                    if (id !== null && index !== null) {
                        this.willAddNewRange = this.inputs[id][index].xc.trim() !== "";
                    }
                    break;
                }
            }
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        getSelectionInput(id) {
            if (!this.inputs[id]) {
                return [];
            }
            return this.inputs[id].map((input, index) => Object.assign({}, input, {
                color: this.focusedInput === id && this.focusedRange !== null ? input.color : null,
                isFocused: this.focusedInput === id && this.focusedRange === index,
            }));
        }
        getSelectionInputValue(id) {
            return this.cleanInputs(this.inputs[id].map((range) => range.xc));
        }
        // ---------------------------------------------------------------------------
        // Other
        // ---------------------------------------------------------------------------
        initInput(id, initialRanges, maximumRanges) {
            this.inputs[id] = initialRanges.map((r) => Object.freeze({
                xc: r,
                id: uuidv4(),
            }));
            if (maximumRanges !== undefined) {
                this.inputMaximums[id] = maximumRanges;
            }
            if (this.inputs[id].length === 0) {
                this.dispatch("ADD_EMPTY_RANGE", { id });
            }
        }
        /**
         * Focus a given range or remove the focus.
         */
        focus(id, index) {
            const currentFocusedInput = this.focusedInput;
            const currentFocusedRange = this.focusedInput && this.focusedRange;
            this.focusedInput = id;
            if (currentFocusedRange !== null && index == null) {
                this.dispatch("HIGHLIGHT_SELECTION", { enabled: false });
                this.removeAllHighlights();
            }
            if (currentFocusedInput !== null && id !== null && currentFocusedInput !== id) {
                this.removeAllHighlights();
            }
            if ((currentFocusedRange === null && index !== null) || currentFocusedInput !== id) {
                this.dispatch("HIGHLIGHT_SELECTION", { enabled: true });
                this.highlightAllRanges(id);
            }
            this.setPendingRange(id, index);
            if (index !== null) {
                const color = this.inputs[id][index].color || getNextColor();
                this.dispatch("SET_HIGHLIGHT_COLOR", { color });
            }
            this.focusedRange = index;
        }
        focusLast(id) {
            this.focus(id, this.inputs[id].length - 1);
        }
        removeAllHighlights() {
            this.dispatch("REMOVE_ALL_HIGHLIGHTS");
        }
        /**
         * Highlight all valid ranges.
         */
        highlightAllRanges(id) {
            const inputs = this.inputs[id];
            for (const [index, input] of inputs.entries()) {
                this.focusedRange = index;
                const ranges = this.inputToHighlights(input);
                if (Object.keys(ranges).length > 0) {
                    this.dispatch("ADD_HIGHLIGHTS", { ranges });
                }
            }
        }
        add(newHighlights) {
            if (this.focusedInput === null ||
                this.focusedRange === null ||
                this.getters.getEditionMode() === "selecting" ||
                newHighlights.length === 0) {
                return;
            }
            const mode = this.getters.getSelectionMode();
            if (mode === SelectionMode.expanding && this.willAddNewRange) {
                this.addNewRange(this.focusedInput, newHighlights);
                this.willAddNewRange = false;
            }
            else {
                this.setRange(this.focusedInput, this.focusedRange, newHighlights);
            }
        }
        /**
         * Add a new input at the end and focus it.
         */
        addNewRange(id, highlights) {
            if (this.inputMaximums[id] < this.inputs[id].length + highlights.length) {
                return;
            }
            this.inputs[id] = this.inputs[id].concat(this.highlightsToInput(highlights));
            this.focusLast(id);
        }
        setRange(id, index, highlights) {
            let [existingRange, ...newRanges] = this.highlightsToInput(highlights);
            const additionalRanges = this.inputs[id].length + newRanges.length - this.inputMaximums[id];
            if (additionalRanges) {
                newRanges = newRanges.slice(0, newRanges.length - additionalRanges);
            }
            this.inputs[id].splice(index, 1, existingRange, ...newRanges);
            // focus the last newly added range
            if (newRanges.length) {
                this.focus(id, index + newRanges.length);
            }
        }
        changeRange(id, index, value) {
            if (this.focusedInput !== id || this.focusedRange !== index) {
                this.dispatch("FOCUS_RANGE", { id, rangeId: this.inputs[id][index].id });
            }
            const input = this.inputs[id][index];
            this.dispatch("REMOVE_HIGHLIGHTS", { ranges: this.inputToHighlights(input) });
            this.dispatch("ADD_HIGHLIGHTS", {
                ranges: this.inputToHighlights({
                    color: input.color,
                    xc: value,
                }),
            });
        }
        removeRange(id, index) {
            const [removedRange] = this.inputs[id].splice(index, 1);
            if (this.focusedInput === id && this.focusedRange !== null) {
                this.dispatch("REMOVE_HIGHLIGHTS", {
                    ranges: this.inputToHighlights(removedRange),
                });
                this.focusLast(id);
            }
        }
        setPendingRange(id, index) {
            this.dispatch("RESET_PENDING_HIGHLIGHT");
            if (index !== null && this.inputs[id][index].xc) {
                this.dispatch("ADD_PENDING_HIGHLIGHTS", {
                    ranges: this.inputToHighlights(this.inputs[id][index]),
                });
            }
        }
        /**
         * Convert highlights to the input format
         */
        highlightsToInput(highlights) {
            return highlights.map((h) => Object.freeze({
                xc: this.getters.zoneToXC(h.zone),
                id: uuidv4(),
                color: h.color,
            }));
        }
        /**
         * Convert highlights input format to the command format.
         * The first xc in the input range will keep its color.
         */
        inputToHighlights({ xc, color }) {
            const ranges = this.cleanInputs([xc]);
            if (ranges.length === 0)
                return {};
            const [fromInput, ...otherRanges] = ranges;
            const highlights = {
                [fromInput]: color || getNextColor(),
            };
            for (const range of otherRanges) {
                highlights[range] = getNextColor();
            }
            return highlights;
        }
        isRangeValid(xc) {
            return xc.match(rangeReference) !== null;
        }
        cleanInputs(ranges) {
            return ranges
                .map((xc) => xc.split(","))
                .flat()
                .map((xc) => xc.trim())
                .filter((xc) => xc !== "")
                .filter(this.isRangeValid);
        }
        /**
         * Return the index of a range given its id
         * or `null` if the range is not found.
         */
        getIndex(id, rangeId) {
            const index = this.inputs[id].findIndex((range) => range.id === rangeId);
            return index >= 0 ? index : null;
        }
    }
    SelectionInputPlugin.modes = ["normal", "readonly"];
    SelectionInputPlugin.layers = [1 /* Highlights */];
    SelectionInputPlugin.getters = ["getSelectionInput", "getSelectionInputValue"];

    const pluginRegistry = new Registry()
        .add("core", CorePlugin)
        .add("evaluation", EvaluationPlugin)
        .add("clipboard", ClipboardPlugin)
        .add("merge", MergePlugin)
        .add("formatting", FormattingPlugin)
        .add("edition", EditionPlugin)
        .add("selection", SelectionPlugin)
        .add("highlight", HighlightPlugin)
        .add("selectionInput", SelectionInputPlugin)
        .add("conditional formatting", ConditionalFormatPlugin)
        .add("figures", FigurePlugin)
        .add("chart", ChartPlugin)
        .add("grid renderer", RendererPlugin)
        .add("autofill", AutofillPlugin);

    /**
     * This is the current state version number. It should be incremented each time
     * a breaking change is made in the way the state is handled, and an upgrade
     * function should be defined
     */
    const CURRENT_VERSION = 5;
    /**
     * This function tries to load anything that could look like a valid
     * workbookData object. It applies any migrations, if needed, and return a
     * current, complete workbookData object.
     *
     * It also ensures that there is at least one sheet.
     */
    function load(data) {
        if (!data) {
            return createEmptyWorkbookData();
        }
        data = Object.assign({}, data);
        // apply migrations, if needed
        if ("version" in data) {
            if (data.version < CURRENT_VERSION) {
                data = migrate(data);
            }
        }
        // sanity check: try to fix missing fields/corrupted state by providing
        // sensible default values
        data = Object.assign(createEmptyWorkbookData(), data, { version: CURRENT_VERSION });
        data.sheets = data.sheets.map((s, i) => Object.assign(createEmptySheet(`Sheet${i + 1}`), s));
        if (!data.sheets.map((s) => s.id).includes(data.activeSheet)) {
            data.activeSheet = data.sheets[0].id;
        }
        if (data.sheets.length === 0) {
            data.sheets.push(createEmptySheet());
        }
        return data;
    }
    function migrate(data) {
        const index = MIGRATIONS.findIndex((m) => m.from === data.version);
        for (let i = index; i < MIGRATIONS.length; i++) {
            data = MIGRATIONS[i].applyMigration(data);
        }
        return data;
    }
    const MIGRATIONS = [
        {
            description: "add the `activeSheet` field on data",
            from: 1,
            to: 2,
            applyMigration(data) {
                if (data.sheets && data.sheets[0]) {
                    data.activeSheet = data.sheets[0].name;
                }
                return data;
            },
        },
        {
            description: "add an id field in each sheet",
            from: 2,
            to: 3,
            applyMigration(data) {
                if (data.sheets && data.sheets.length) {
                    for (let sheet of data.sheets) {
                        sheet.id = sheet.id || sheet.name;
                    }
                }
                return data;
            },
        },
        {
            description: "activeSheet is now an id, not the name of a sheet",
            from: 3,
            to: 4,
            applyMigration(data) {
                const activeSheet = data.sheets.find((s) => s.name === data.activeSheet);
                data.activeSheet = activeSheet.id;
                return data;
            },
        },
        {
            description: "add figures object in each sheets",
            from: 4,
            to: 5,
            applyMigration(data) {
                for (let sheet of data.sheets) {
                    sheet.figures = sheet.figures || [];
                }
                return data;
            },
        },
    ];
    // -----------------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------------
    function createEmptySheet(name = "Sheet1") {
        return {
            id: uuidv4(),
            name,
            colNumber: 26,
            rowNumber: 100,
            cells: {},
            cols: {},
            rows: {},
            merges: [],
            conditionalFormats: [],
            figures: [],
        };
    }
    function createEmptyWorkbookData() {
        const data = {
            version: CURRENT_VERSION,
            sheets: [createEmptySheet("Sheet1")],
            activeSheet: "",
            entities: {},
            styles: {},
            borders: {},
        };
        data.activeSheet = data.sheets[0].id;
        return data;
    }
    function createEmptyWorkbook() {
        return {
            visibleSheets: [],
            sheets: {},
            activeSheet: null,
        };
    }

    /**
     * Max Number of history steps kept in memory
     */
    const MAX_HISTORY_STEPS = 99;
    class WHistory {
        constructor(workbook) {
            this.current = null;
            this.undoStack = [];
            this.redoStack = [];
            this.workbook = workbook;
        }
        // getters
        canUndo() {
            return this.undoStack.length > 0;
        }
        canRedo() {
            return this.redoStack.length > 0;
        }
        allowDispatch(cmd) {
            switch (cmd.type) {
                case "UNDO":
                    return this.canUndo()
                        ? { status: "SUCCESS" }
                        : { status: "CANCELLED", reason: 3 /* EmptyUndoStack */ };
                case "REDO":
                    return this.canRedo()
                        ? { status: "SUCCESS" }
                        : { status: "CANCELLED", reason: 4 /* EmptyRedoStack */ };
            }
            return { status: "SUCCESS" };
        }
        beforeHandle(cmd) {
            if (!this.current && cmd.type !== "REDO" && cmd.type !== "UNDO") {
                this.current = [];
            }
        }
        handle(cmd) {
            switch (cmd.type) {
                case "UNDO":
                    this.undo();
                    break;
                case "REDO":
                    this.redo();
                    break;
            }
        }
        finalize() {
            if (this.current && this.current.length) {
                if (!this.isActiveSheet()) {
                    // We do not want to save the ACTIVATE_SHEET command if triggered
                    // standalone
                    this.undoStack.push(this.current);
                }
                this.redoStack = [];
                this.current = null;
                if (this.undoStack.length > MAX_HISTORY_STEPS) {
                    this.undoStack.shift();
                }
            }
        }
        isActiveSheet() {
            return (this.current &&
                this.current.length === 1 &&
                this.current[0].path.length === 1 &&
                this.current[0].path[0] === "activeSheet");
        }
        undo() {
            const step = this.undoStack.pop();
            if (!step) {
                return;
            }
            this.redoStack.push(step);
            for (let i = step.length - 1; i >= 0; i--) {
                let change = step[i];
                this.applyChange(change, "before");
            }
        }
        redo() {
            const step = this.redoStack.pop();
            if (!step) {
                return;
            }
            this.undoStack.push(step);
            for (let change of step) {
                this.applyChange(change, "after");
            }
        }
        applyChange(change, target) {
            let val = change.root;
            let key = change.path[change.path.length - 1];
            for (let p of change.path.slice(0, -1)) {
                val = val[p];
            }
            if (change[target] === undefined) {
                delete val[key];
            }
            else {
                val[key] = change[target];
            }
        }
        updateStateFromRoot(root, path, val) {
            let value = root;
            let key = path[path.length - 1];
            for (let p of path.slice(0, -1)) {
                value = value[p];
            }
            if (value[key] === val) {
                return;
            }
            if (this.current) {
                this.current.push({
                    root,
                    path,
                    before: value[key],
                    after: val,
                });
            }
            if (val === undefined) {
                delete value[key];
            }
            else {
                value[key] = val;
            }
        }
        updateState(path, val) {
            this.updateStateFromRoot(this.workbook, path, val);
        }
        updateCell(cell, key, value) {
            this.updateStateFromRoot(cell, [key], value);
        }
        updateSheet(sheet, path, value) {
            this.updateStateFromRoot(sheet, path, value);
        }
    }

    var Status;
    (function (Status) {
        Status[Status["Ready"] = 0] = "Ready";
        Status[Status["Running"] = 1] = "Running";
        Status[Status["Finalizing"] = 2] = "Finalizing";
        Status[Status["Interactive"] = 3] = "Interactive";
    })(Status || (Status = {}));
    class Model extends owl__namespace.core.EventBus {
        constructor(data = {}, config = {}) {
            super();
            /**
             * A plugin can draw some contents on the canvas. But even better: it can do
             * so multiple times.  The order of the render calls will determine a list of
             * "layers" (i.e., earlier calls will be obviously drawn below later calls).
             * This list simply keeps the renderers+layer information so the drawing code
             * can just iterate on it
             */
            this.renderers = [];
            /**
             * Internal status of the model. Important for command handling coordination
             */
            this.status = 0 /* Ready */;
            // ---------------------------------------------------------------------------
            // Command Handling
            // ---------------------------------------------------------------------------
            /**
             * The dispatch method is the only entry point to manipulate date in the model.
             * This is through this method that commands are dispatched, most of the time
             * recursively until no plugin want to react anymore.
             *
             * Small technical detail: it is defined as an arrow function.  There are two
             * reasons for this:
             * 1. this means that the dispatch method can be "detached" from the model,
             *    which is done when it is put in the environment (see the Spreadsheet
             *    component)
             * 2. This allows us to define its type by using the interface CommandDispatcher
             */
            this.dispatch = (type, payload) => {
                const command = Object.assign({ type }, payload);
                let status = command.interactive ? 3 /* Interactive */ : this.status;
                switch (status) {
                    case 0 /* Ready */:
                        for (let handler of this.handlers) {
                            const allowDispatch = handler.allowDispatch(command);
                            if (allowDispatch.status === "CANCELLED") {
                                return allowDispatch;
                            }
                        }
                        this.status = 1 /* Running */;
                        for (const h of this.handlers) {
                            h.beforeHandle(command);
                        }
                        for (const h of this.handlers) {
                            h.handle(command);
                        }
                        this.status = 2 /* Finalizing */;
                        for (const h of this.handlers) {
                            h.finalize(command);
                        }
                        this.status = 0 /* Ready */;
                        if (this.config.mode !== "headless") {
                            this.trigger("update");
                        }
                        break;
                    case 1 /* Running */:
                    case 3 /* Interactive */:
                        for (const h of this.handlers) {
                            h.beforeHandle(command);
                        }
                        for (const h of this.handlers) {
                            h.handle(command);
                        }
                        break;
                    case 2 /* Finalizing */:
                        throw new Error(_lt("Nope. Don't do that"));
                }
                return { status: "SUCCESS" };
            };
            DEBUG.model = this;
            const workbookData = load(data);
            this.workbook = createEmptyWorkbook();
            const history = new WHistory(this.workbook);
            this.getters = {
                canUndo: history.canUndo.bind(history),
                canRedo: history.canRedo.bind(history),
            };
            this.handlers = [history];
            this.config = {
                mode: config.mode || "normal",
                openSidePanel: config.openSidePanel || (() => { }),
                notifyUser: config.notifyUser || (() => { }),
                askConfirmation: config.askConfirmation || (() => { }),
                editText: config.editText || (() => { }),
                evalContext: config.evalContext || {},
            };
            // registering plugins
            for (let Plugin of pluginRegistry.getAll()) {
                this.setupPlugin(Plugin, workbookData);
            }
            // starting plugins
            this.dispatch("START");
        }
        destroy() {
            delete DEBUG.model;
        }
        /**
         * Initialise and properly configure a plugin.
         *
         * This method is private for now, but if the need arise, there is no deep
         * reason why the model could not add dynamically a plugin while it is running.
         */
        setupPlugin(Plugin, data) {
            const dispatch = this.dispatch.bind(this);
            const history = this.handlers.find((p) => p instanceof WHistory);
            if (Plugin.modes.includes(this.config.mode)) {
                const plugin = new Plugin(this.workbook, this.getters, history, dispatch, this.config);
                plugin.import(data);
                for (let name of Plugin.getters) {
                    if (!(name in plugin)) {
                        throw new Error(`Invalid getter name: ${name} for plugin ${plugin.constructor}`);
                    }
                    this.getters[name] = plugin[name].bind(plugin);
                }
                this.handlers.push(plugin);
                const layers = Plugin.layers.map((l) => [plugin, l]);
                this.renderers.push(...layers);
                this.renderers.sort((p1, p2) => p1[1] - p2[1]);
            }
        }
        // ---------------------------------------------------------------------------
        // Grid Rendering
        // ---------------------------------------------------------------------------
        /**
         * When the Grid component is ready (= mounted), it has a reference to its
         * canvas and need to draw the grid on it.  This is then done by calling this
         * method, which will dispatch the call to all registered plugins.
         *
         * Note that nothing prevent multiple grid components from calling this method
         * each, or one grid component calling it multiple times with a different
         * context. This is probably the way we should do if we want to be able to
         * freeze a part of the grid (so, we would need to render different zones)
         */
        drawGrid(context) {
            // we make sure here that the viewport is properly positioned: the offsets
            // correspond exactly to a cell
            context.viewport = this.getters.snapViewportToCell(context.viewport);
            for (let [renderer, layer] of this.renderers) {
                renderer.drawGrid(context, layer);
            }
        }
        // ---------------------------------------------------------------------------
        // Data Export
        // ---------------------------------------------------------------------------
        /**
         * As the name of this method strongly implies, it is useful when we need to
         * export date out of the model.
         */
        exportData() {
            const data = createEmptyWorkbookData();
            for (let handler of this.handlers) {
                if (handler instanceof BasePlugin) {
                    handler.export(data);
                }
            }
            return data;
        }
    }

    /**
     * Return true if the event was triggered from
     * a child element.
     */
    function isChildEvent(parent, ev) {
        return !!ev.target && parent.contains(ev.target);
    }

    const { xml: xml$a, css: css$a } = owl.tags;
    const { useExternalListener: useExternalListener$2, useRef: useRef$4 } = owl.hooks;
    const MENU_WIDTH = 200;
    const MENU_ITEM_HEIGHT = 32;
    const SEPARATOR_HEIGHT = 1;
    //------------------------------------------------------------------------------
    // Context Menu Component
    //------------------------------------------------------------------------------
    const TEMPLATE$8 = xml$a /* xml */ `
    <div>
      <div class="o-menu" t-att-style="style" t-on-scroll="onScroll" t-on-wheel.stop="" t-on-contextmenu.prevent="">
        <t t-foreach="props.menuItems" t-as="menuItem" t-key="menuItem.id">
          <t t-set="isMenuRoot" t-value="isRoot(menuItem)"/>
          <t t-set="isMenuEnabled" t-value="isEnabled(menuItem)"/>
          <div
            t-att-title="getName(menuItem)"
            t-att-data-name="menuItem.id"
            t-on-click="onClickMenu(menuItem, menuItem_index)"
            t-on-mouseover="onMouseOver(menuItem, menuItem_index)"
            class="o-menu-item"
            t-att-class="{
              'o-menu-root': isMenuRoot,
              'o-separator': menuItem.separator and !menuItem_last,
              'disabled': !isMenuEnabled,
            }">
            <t t-esc="getName(menuItem)"/>
            <t t-if="isMenuRoot">
              ${TRIANGLE_RIGHT_ICON}
            </t>
          </div>
        </t>
      </div>
      <Menu t-if="subMenu.isOpen"
        position="subMenuPosition"
        menuItems="subMenu.menuItems"
        depth="props.depth + 1"
        t-ref="subMenuRef"
        t-on-close="subMenu.isOpen=false"/>
    </div>`;
    const CSS$8 = css$a /* scss */ `
  .o-menu {
    position: absolute;
    width: ${MENU_WIDTH}px;
    background-color: white;
    box-shadow: 1px 2px 5px 2px rgba(51, 51, 51, 0.15);
    font-size: 13px;
    overflow-y: auto;
    z-index: 10;
    padding: 5px 0px;
    .o-menu-item {
      box-sizing: border-box;
      height: ${MENU_ITEM_HEIGHT}px;
      padding: 7px 20px;
      padding-right: 2px;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      cursor: pointer;
      user-select: none;

      &:hover {
        background-color: #ebebeb;
      }

      &.disabled {
        color: grey;
        cursor: not-allowed;
      }

      &.o-separator {
        border-bottom: ${SEPARATOR_HEIGHT}px solid #e0e2e4;
      }

      &.o-menu-root {
        display: flex;
        justify-content: space-between;
      }
    }
  }
`;
    class Menu extends owl.Component {
        constructor() {
            super(...arguments);
            this.subMenuRef = useRef$4("subMenuRef");
            useExternalListener$2(window, "click", this.onClick);
            useExternalListener$2(window, "contextmenu", this.onContextMenu);
            this.subMenu = owl.useState({
                isOpen: false,
                position: null,
                scrollOffset: 0,
                menuItems: [],
            });
        }
        get subMenuPosition() {
            const position = Object.assign({}, this.subMenu.position);
            position.y -= this.subMenu.scrollOffset || 0;
            return position;
        }
        get renderRight() {
            const { x, width } = this.props.position;
            return x < width - MENU_WIDTH;
        }
        get renderBottom() {
            const { y, height } = this.props.position;
            return y < height - this.menuHeight;
        }
        get menuHeight() {
            const separators = this.props.menuItems.filter((m) => m.separator);
            const others = this.props.menuItems;
            return MENU_ITEM_HEIGHT * others.length + separators.length * SEPARATOR_HEIGHT;
        }
        get style() {
            const { x, height } = this.props.position;
            const hStyle = `left:${this.renderRight ? x : x - MENU_WIDTH}`;
            const vStyle = `top:${this.menuVerticalPosition()}`;
            const heightStyle = `max-height:${height}`;
            return `${vStyle}px;${hStyle}px;${heightStyle}px`;
        }
        activateMenu(menu) {
            menu.action(this.env);
            this.close();
        }
        close() {
            this.subMenu.isOpen = false;
            this.trigger("close");
        }
        menuVerticalPosition() {
            const { y, height } = this.props.position;
            if (this.renderBottom) {
                return y;
            }
            return Math.max(MENU_ITEM_HEIGHT, y - Math.min(this.menuHeight, height));
        }
        subMenuHorizontalPosition() {
            const { x, width } = this.props.position;
            const spaceRight = x + 2 * MENU_WIDTH < width;
            if (this.renderRight && spaceRight) {
                return x + MENU_WIDTH;
            }
            else if (this.renderRight && !spaceRight) {
                return x - MENU_WIDTH;
            }
            return x - (this.props.depth + 1) * MENU_WIDTH;
        }
        subMenuVerticalPosition(menuCount, position) {
            const { height } = this.props.position;
            const y = this.menuVerticalPosition() + this.menuItemVerticalOffset(position);
            const subMenuHeight = menuCount * MENU_ITEM_HEIGHT;
            const spaceBelow = y < height - subMenuHeight;
            if (spaceBelow) {
                return y;
            }
            return Math.max(MENU_ITEM_HEIGHT, y - subMenuHeight + MENU_ITEM_HEIGHT);
        }
        /**
         * Return the number of pixels between the top of the menu
         * and the menu item at a given index.
         */
        menuItemVerticalOffset(index) {
            return this.props.menuItems.slice(0, index).length * MENU_ITEM_HEIGHT;
        }
        onClick(ev) {
            // Don't close a root menu when clicked to open the submenus.
            if (this.el && isChildEvent(this.el, ev)) {
                return;
            }
            this.close();
        }
        onContextMenu(ev) {
            // Don't close a root menu when clicked to open the submenus.
            if (this.el && isChildEvent(this.el, ev)) {
                return;
            }
            this.subMenu.isOpen = false;
        }
        getName(menu) {
            return cellMenuRegistry.getName(menu, this.env);
        }
        isRoot(menu) {
            return !menu.action;
        }
        isEnabled(menu) {
            return menu.isEnabled(this.env);
        }
        closeSubMenus() {
            if (this.subMenuRef.comp) {
                this.subMenuRef.comp.closeSubMenus();
            }
            this.subMenu.isOpen = false;
        }
        onScroll(ev) {
            this.subMenu.scrollOffset = ev.target.scrollTop;
        }
        /**
         * If the given menu is not disabled, open it's submenu at the
         * correct position according to available surrounding space.
         */
        openSubMenu(menu, position) {
            this.closeSubMenus();
            this.subMenu.isOpen = true;
            this.subMenu.menuItems = cellMenuRegistry.getChildren(menu, this.env);
            const { width, height } = this.props.position;
            this.subMenu.position = {
                x: this.subMenuHorizontalPosition(),
                y: this.subMenuVerticalPosition(this.subMenu.menuItems.length, position),
                height,
                width,
            };
        }
        onClickMenu(menu, position) {
            if (menu.isEnabled(this.env)) {
                if (this.isRoot(menu)) {
                    this.openSubMenu(menu, position);
                }
                else {
                    this.activateMenu(menu);
                }
            }
        }
        onMouseOver(menu, position) {
            if (menu.isEnabled(this.env)) {
                if (this.isRoot(menu)) {
                    this.openSubMenu(menu, position);
                }
                else {
                    this.subMenu.isOpen = false;
                }
            }
        }
    }
    Menu.template = TEMPLATE$8;
    Menu.components = { Menu };
    Menu.style = CSS$8;
    Menu.defaultProps = {
        depth: 1,
    };

    const Component$8 = owl__namespace.Component;
    const { xml: xml$9, css: css$9 } = owl__namespace.tags;
    const { useState: useState$9 } = owl__namespace.hooks;
    // -----------------------------------------------------------------------------
    // SpreadSheet
    // -----------------------------------------------------------------------------
    const TEMPLATE$7 = xml$9 /* xml */ `
  <div class="o-spreadsheet-bottom-bar">
    <div class="o-sheet-item o-add-sheet" t-on-click="addSheet">${PLUS}</div>
    <div class="o-sheet-item o-list-sheets" t-on-click="listSheets">${LIST}</div>
    <div class="o-all-sheets">
      <t t-foreach="getters.getSheets()" t-as="sheet" t-key="sheet.id">
        <div class="o-sheet-item o-sheet" t-on-click="activateSheet(sheet.id)"
             t-on-contextmenu.prevent="onContextMenu(sheet.id)"
             t-att-title="sheet.name"
             t-att-data-id="sheet.id"
             t-att-class="{active: sheet.id === getters.getActiveSheet()}">
          <span class="o-sheet-name" t-esc="sheet.name" t-on-dblclick="onDblClick(sheet.id)"/>
          <span class="o-sheet-icon" t-on-click.stop="onIconClick(sheet.id)">${TRIANGLE_DOWN_ICON}</span>
        </div>
      </t>
    </div>
    <t t-set="aggregate" t-value="getters.getAggregate()"/>
    <div t-if="aggregate !== null" class="o-aggregate">Sum: <t t-esc="aggregate"/></div>
    <Menu t-if="menuState.isOpen"
          position="menuState.position"
          menuItems="menuState.menuItems"
          t-on-close="menuState.isOpen=false"/>
  </div>`;
    const CSS$7 = css$9 /* scss */ `
  .o-spreadsheet-bottom-bar {
    background-color: ${BACKGROUND_GRAY_COLOR};
    padding-left: ${HEADER_WIDTH}px;
    display: flex;
    align-items: center;
    font-size: 15px;
    border-top: 1px solid lightgrey;
    overflow: hidden;

    .o-add-sheet,
    .o-list-sheets {
      margin-right: 5px;
    }

    .o-sheet-item {
      display: flex;
      align-items: center;
      padding: 5px;
      cursor: pointer;
      &:hover {
        background-color: rgba(0, 0, 0, 0.08);
      }
    }

    .o-all-sheets {
      display: flex;
      align-items: center;
      max-width: 80%;
      overflow: hidden;
    }

    .o-sheet {
      color: #666;
      padding: 0 15px;
      padding-right: 10px;
      height: ${BOTTOMBAR_HEIGHT}px;
      line-height: ${BOTTOMBAR_HEIGHT}px;
      user-select: none;
      white-space: nowrap;

      &.active {
        color: #484;
        background-color: white;
        box-shadow: 0 1px 3px 1px rgba(60, 64, 67, 0.15);
      }

      .o-sheet-icon {
        margin-left: 5px;

        &:hover {
          background-color: rgba(0, 0, 0, 0.08);
        }
      }
    }

    .o-aggregate {
      background-color: white;
      margin-left: auto;
      font-size: 14px;
      margin-right: 20px;
      padding: 4px 8px;
      color: #333;
      border-radius: 3px;
      box-shadow: 0 1px 3px 1px rgba(60, 64, 67, 0.15);
    }
    .fade-enter-active {
      transition: opacity 0.5s;
    }

    .fade-enter {
      opacity: 0;
    }
  }
`;
    class BottomBar extends Component$8 {
        constructor() {
            super(...arguments);
            this.getters = this.env.getters;
            this.menuState = useState$9({ isOpen: false, position: null, menuItems: [] });
        }
        mounted() {
            this.focusSheet();
        }
        patched() {
            this.focusSheet();
        }
        focusSheet() {
            const div = this.el.querySelector(`[data-id="${this.getters.getActiveSheet()}"]`);
            if (div && div.scrollIntoView) {
                div.scrollIntoView();
            }
        }
        addSheet() {
            this.env.dispatch("CREATE_SHEET", { activate: true, id: uuidv4() });
        }
        listSheets(ev) {
            const registry = new MenuItemRegistry();
            const from = this.getters.getActiveSheet();
            let i = 0;
            for (let sheet of this.getters.getSheets()) {
                registry.add(sheet.id, {
                    name: sheet.name,
                    sequence: i,
                    action: (env) => env.dispatch("ACTIVATE_SHEET", { from, to: sheet.id }),
                });
                i++;
            }
            this.openContextMenu(ev.currentTarget, registry);
        }
        activateSheet(name) {
            this.env.dispatch("ACTIVATE_SHEET", { from: this.getters.getActiveSheet(), to: name });
        }
        onDblClick(sheet) {
            this.env.dispatch("RENAME_SHEET", { interactive: true, sheet });
        }
        openContextMenu(target, registry) {
            const x = target.offsetLeft;
            const y = target.offsetTop;
            this.menuState.isOpen = true;
            this.menuState.menuItems = registry.getAll().filter((x) => x.isVisible(this.env));
            this.menuState.position = {
                x,
                y,
                height: 400,
                width: this.el.clientWidth,
            };
        }
        onIconClick(sheet, ev) {
            if (this.getters.getActiveSheet() !== sheet) {
                this.activateSheet(sheet);
            }
            if (this.menuState.isOpen) {
                this.menuState.isOpen = false;
            }
            else {
                this.openContextMenu(ev.currentTarget.parentElement, sheetMenuRegistry);
            }
        }
        onContextMenu(sheet, ev) {
            if (this.getters.getActiveSheet() !== sheet) {
                this.activateSheet(sheet);
            }
            this.openContextMenu(ev.currentTarget, sheetMenuRegistry);
        }
    }
    BottomBar.template = TEMPLATE$7;
    BottomBar.style = CSS$7;
    BottomBar.components = { Menu };

    function startDnd(onMouseMove, onMouseUp) {
        const _onMouseUp = (ev) => {
            onMouseUp(ev);
            window.removeEventListener("mouseup", _onMouseUp);
            window.removeEventListener("dragstart", _onDragStart);
            window.removeEventListener("mousemove", onMouseMove);
        };
        function _onDragStart(ev) {
            ev.preventDefault();
        }
        window.addEventListener("mouseup", _onMouseUp);
        window.addEventListener("dragstart", _onDragStart);
        window.addEventListener("mousemove", onMouseMove);
    }

    const Component$7 = owl__namespace.Component;
    const { xml: xml$8, css: css$8 } = owl__namespace.tags;
    const { useState: useState$8 } = owl__namespace.hooks;
    // -----------------------------------------------------------------------------
    // Autofill
    // -----------------------------------------------------------------------------
    const TEMPLATE$6 = xml$8 /* xml */ `
  <div class="o-autofill" t-on-mousedown="onMouseDown" t-att-style="style" t-on-dblclick="onDblClick">
    <div class="o-autofill-handler" t-att-style="styleHandler"/>
    <t t-set="tooltip" t-value="getTooltip()"/>
    <div t-if="tooltip" class="o-autofill-nextvalue" t-att-style="styleNextvalue">
      <t t-component="tooltip.component" t-props="tooltip.props"/>
    </div>
  </div>
`;
    const CSS$6 = css$8 /* scss */ `
  .o-autofill {
    height: 6px;
    width: 6px;
    border: 1px solid white;
    position: absolute;
    background-color: #1a73e8;

    .o-autofill-handler {
      position: absolute;
      height: 8px;
      width: 8px;

      &:hover {
        cursor: crosshair;
      }
    }

    .o-autofill-nextvalue {
      position: absolute;
      background-color: white;
      border: 1px solid black;
      padding: 5px;
      font-size: 12px;
      pointer-events: none;
      white-space: nowrap;
    }
  }
`;
    class Autofill extends Component$7 {
        constructor() {
            super(...arguments);
            this.state = useState$8({
                position: { left: 0, top: 0 },
                handler: false,
            });
        }
        get style() {
            const { left, top } = this.props.position;
            return `top:${top}px;left:${left}px`;
        }
        get styleHandler() {
            let position = this.state.handler ? this.state.position : { left: 0, top: 0 };
            return `top:${position.top}px;left:${position.left}px;`;
        }
        get styleNextvalue() {
            let position = this.state.handler ? this.state.position : { left: 0, top: 0 };
            return `top:${position.top + 5}px;left:${position.left + 15}px;`;
        }
        getTooltip() {
            const tooltip = this.env.getters.getAutofillTooltip();
            if (tooltip && !tooltip.component) {
                tooltip.component = TooltipComponent;
            }
            return tooltip;
        }
        onMouseDown(ev) {
            this.state.handler = true;
            this.state.position = { left: 0, top: 0 };
            const start = { left: ev.clientX, top: ev.clientY };
            let lastCol;
            let lastRow;
            const onMouseUp = () => {
                this.state.handler = false;
                this.env.dispatch("AUTOFILL");
            };
            const onMouseMove = (ev) => {
                this.state.position = {
                    left: ev.clientX - start.left,
                    top: ev.clientY - start.top,
                };
                const parent = this.el.parentElement;
                const position = parent.getBoundingClientRect();
                const col = this.env.getters.getColIndex(ev.clientX - position.left, this.props.viewport.left);
                const row = this.env.getters.getRowIndex(ev.clientY - position.top, this.props.viewport.top);
                if (lastCol !== col || lastRow !== row) {
                    const sheetId = this.env.getters.getActiveSheet();
                    lastCol = col === -1 ? lastCol : clip(col, 0, this.env.getters.getNumberCols(sheetId));
                    lastRow = row === -1 ? lastRow : clip(row, 0, this.env.getters.getNumberRows(sheetId));
                    if (lastCol !== undefined && lastRow !== undefined) {
                        this.env.dispatch("AUTOFILL_SELECT", { col: lastCol, row: lastRow });
                    }
                }
            };
            startDnd(onMouseMove, onMouseUp);
        }
        onDblClick() {
            this.env.dispatch("AUTOFILL_AUTO");
        }
    }
    Autofill.template = TEMPLATE$6;
    Autofill.style = CSS$6;
    class TooltipComponent extends Component$7 {
    }
    TooltipComponent.template = xml$8 /* xml */ `
    <div t-esc="props.content"/>
  `;

    const Component$6 = owl__namespace.Component;
    const { useState: useState$7 } = owl__namespace;
    const { xml: xml$7, css: css$7 } = owl__namespace.tags;
    const functions = functionRegistry.content;
    const providerRegistry = new Registry();
    providerRegistry.add("functions", async function () {
        return Object.keys(functions).map((key) => {
            return {
                text: key,
                description: functions[key].description,
            };
        });
    });
    // -----------------------------------------------------------------------------
    // Autocomplete DropDown component
    // -----------------------------------------------------------------------------
    const TEMPLATE$5 = xml$7 /* xml */ `
  <div t-att-class="{'o-autocomplete-dropdown':state.values.length}" >
    <t t-foreach="state.values" t-as="v" t-key="v.text">
        <div t-att-class="{'o-autocomplete-value-focus': state.selectedIndex === v_index}" t-on-click.stop.prevent="fillValue(v_index)">
             <div class="o-autocomplete-value" t-esc="v.text"/>
             <div class="o-autocomplete-description" t-esc="v.description" t-if="state.selectedIndex === v_index"/>
        </div>
    </t>
  </div>`;
    const CSS$5 = css$7 /* scss */ `
  .o-autocomplete-dropdown {
    width: 260px;
    margin: 4px;
    background-color: #fff;
    box-shadow: 0 1px 4px 3px rgba(60, 64, 67, 0.15);

    & > div:hover {
      background-color: #f2f2f2;
    }
    .o-autocomplete-value-focus {
      background-color: rgba(0, 0, 0, 0.08);
    }

    & > div {
      display: flex;
      flex-direction: column;
      padding: 1px 0 5px 5px;
      .o-autocomplete-description {
        padding: 0 0 0 5px;
        font-size: 11px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  }
`;
    class TextValueProvider extends Component$6 {
        constructor() {
            super(...arguments);
            this.state = useState$7({
                values: [],
                selectedIndex: 0,
            });
        }
        mounted() {
            this.filter(this.props.search);
        }
        willUpdateProps(nextProps) {
            if (nextProps.search !== this.props.search) {
                this.filter(nextProps.search);
            }
            return super.willUpdateProps(nextProps);
        }
        async filter(searchTerm) {
            const provider = providerRegistry.get(this.props.provider);
            let values = await provider();
            if (this.props.filter) {
                values = this.props.filter(searchTerm, values);
            }
            else {
                values = values
                    .filter((t) => t.text.toUpperCase().startsWith(searchTerm.toUpperCase()))
                    .sort((l, r) => (l.text < r.text ? -1 : l.text > r.text ? 1 : 0));
            }
            this.state.values = values.slice(0, 10);
            this.state.selectedIndex = 0;
        }
        fillValue(index) {
            this.state.selectedIndex = index;
            this.trigger("completed", { text: this.getValueToFill() });
        }
        moveDown() {
            this.state.selectedIndex = (this.state.selectedIndex + 1) % this.state.values.length;
        }
        moveUp() {
            this.state.selectedIndex--;
            if (this.state.selectedIndex < 0) {
                this.state.selectedIndex = this.state.values.length - 1;
            }
        }
        getValueToFill() {
            if (this.state.values.length) {
                return this.state.values[this.state.selectedIndex].text;
            }
        }
    }
    TextValueProvider.template = TEMPLATE$5;
    TextValueProvider.style = CSS$5;

    class ContentEditableHelper {
        constructor(el) {
            this.el = el;
        }
        updateEl(el) {
            this.el = el;
            this.el.focus();
        }
        /**
         * select the text at position start to end, no matter the children
         */
        selectRange(start, end) {
            let selection = window.getSelection();
            this.removeSelection();
            let range = document.createRange();
            if (start == end && start === 0) {
                range.setStart(this.el, 0);
                range.setEnd(this.el, 0);
            }
            else {
                if (start < 0 || end > this.el.textContent.length) {
                    console.warn(`wrong selection asked start ${start}, end ${end}, text content length ${this.el.textContent.length}`);
                    if (start < 0)
                        start = 0;
                    if (end > this.el.textContent.length)
                        end = this.el.textContent.length;
                }
                let startNode = this.findChildAtCharacterIndex(start);
                let endNode = this.findChildAtCharacterIndex(end);
                range.setStart(startNode.node, startNode.offset);
                range.setEnd(endNode.node, endNode.offset);
            }
            selection.addRange(range);
        }
        /**
         * finds the dom element that contains the character at `offset`
         */
        findChildAtCharacterIndex(offset) {
            let it = this.iterateChildren(this.el);
            let current, previous;
            let usedCharacters = offset;
            do {
                current = it.next();
                if (!current.done && !current.value.hasChildNodes()) {
                    if (current.value.textContent && current.value.textContent.length < usedCharacters) {
                        usedCharacters -= current.value.textContent.length;
                    }
                    else {
                        it.return(current.value);
                    }
                    previous = current.value;
                }
            } while (!current.done);
            if (current.value) {
                return { node: current.value, offset: usedCharacters };
            }
            return { node: previous, offset: usedCharacters };
        }
        /**
         * Iterate over the dom tree starting at `el` and over all the children depth first.
         * */
        *iterateChildren(el) {
            yield el;
            if (el.hasChildNodes()) {
                for (let child of el.childNodes) {
                    yield* this.iterateChildren(child);
                }
            }
        }
        /**
         * insert text at the current selection point. If a selection of 1 or more elements is done,
         * the selection is replaced by the text to be inserted
         * */
        insertText(value, color = "#000") {
            document.execCommand("foreColor", false, color);
            document.execCommand("insertText", false, value);
        }
        /**
         * remove the current selection of the user
         * */
        removeSelection() {
            let selection = window.getSelection();
            selection.removeAllRanges();
        }
        removeAll() {
            if (this.el) {
                while (this.el.firstChild) {
                    this.el.removeChild(this.el.firstChild);
                }
            }
        }
        /**
         * finds the indexes of the current selection.
         * */
        getCurrentSelection() {
            let { startElement, endElement, startSelectionOffset, endSelectionOffset } = this.getStartAndEndSelection();
            let startSizeBefore = this.findSelectionIndex(startElement, startSelectionOffset);
            let endSizeBefore = this.findSelectionIndex(endElement, endSelectionOffset);
            return {
                start: startSizeBefore,
                end: endSizeBefore,
            };
        }
        /**
         * Computes the text 'index' inside this.el based on the currently selected node and its offset.
         * The selected node is either a Text node or an Element node.
         *
         * case 1 -Text node:
         * the offset is the number of characters from the start of the node. We have to add this offset to the
         * content length of all previous nodes.
         *
         * case 2 - Element node:
         * the offset is the number of child nodes before the selected node. We have to add the content length of
         * all the bnodes prior to the selected node as well as the content of the child node before the offset.
         *
         * See the MDN documentation for more details.
         * https://developer.mozilla.org/en-US/docs/Web/API/Range/startOffset
         * https://developer.mozilla.org/en-US/docs/Web/API/Range/endOffset
         *
         */
        findSelectionIndex(nodeToFind, nodeOffset) {
            let it = this.iterateChildren(this.el);
            let usedCharacters = 0;
            let current = it.next();
            while (!current.done && current.value !== nodeToFind) {
                if (!current.value.hasChildNodes()) {
                    if (current.value.textContent) {
                        usedCharacters += current.value.textContent.length;
                    }
                }
                current = it.next();
            }
            if (current.value === nodeToFind) {
                if (!current.value.hasChildNodes()) {
                    usedCharacters += nodeOffset;
                }
                else {
                    const children = [...current.value.childNodes].slice(0, nodeOffset);
                    for (const child of children) {
                        if (!child.textContent)
                            continue;
                        usedCharacters += child.textContent.length;
                    }
                }
            }
            return usedCharacters;
        }
        getStartAndEndSelection() {
            const selection = document.getSelection();
            const range = selection.getRangeAt(0);
            return {
                startElement: range.startContainer,
                startSelectionOffset: range.startOffset,
                endElement: range.endContainer,
                endSelectionOffset: range.endOffset,
            };
        }
    }

    const Component$5 = owl__namespace.Component;
    const { useRef: useRef$3, useState: useState$6 } = owl__namespace.hooks;
    const { xml: xml$6, css: css$6 } = owl__namespace.tags;
    const FunctionColor = "#4a4e4d";
    const OperatorColor = "#3da4ab";
    const StringColor = "#f6cd61";
    const NumberColor = "#02c39a";
    const MatchingParenColor = "pink";
    const tokenColor = {
        OPERATOR: OperatorColor,
        NUMBER: NumberColor,
        STRING: StringColor,
        BOOLEAN: NumberColor,
        FUNCTION: FunctionColor,
        DEBUGGER: OperatorColor,
        LEFT_PAREN: OperatorColor,
        RIGHT_PAREN: OperatorColor,
    };
    const TEMPLATE$4 = xml$6 /* xml */ `
<div class="o-composer-container" t-att-style="containerStyle">
    <div class="o-composer"
      t-att-style="composerStyle"
      t-ref="o_composer"
      tabindex="1"
      contenteditable="true"
      spellcheck="false"

      t-on-keydown="onKeydown"
      t-on-input="onInput"
      t-on-keyup="onKeyup"

      t-on-blur="saveSelection"
      t-on-click="onClick"
    />
    <TextValueProvider
        t-if="autoCompleteState.showProvider"
        t-ref="o_autocomplete_provider"
        search="autoCompleteState.search"
        provider="autoCompleteState.provider"
        t-on-completed="onCompleted"
    />
</div>
  `;
    const CSS$4 = css$6 /* scss */ `
  .o-composer-container {
    box-sizing: border-box;
    position: absolute;
    padding: 0;
    margin: 0;
    border: 0;
    z-index: 5;
    .o-composer {
      caret-color: black;
      box-sizing: border-box;
      background-color: white;
      padding-left: 2px;
      padding-right: 2px;
      border: 1.6px solid #3266ca;
      white-space: nowrap;
      &:focus {
        outline: none;
      }
    }
  }
`;
    class Composer extends Component$5 {
        constructor() {
            super(...arguments);
            this.composerRef = useRef$3("o_composer");
            this.autoCompleteRef = useRef$3("o_autocomplete_provider");
            this.getters = this.env.getters;
            this.dispatch = this.env.dispatch;
            this.selectionEnd = 0;
            this.selectionStart = 0;
            this.autoCompleteState = useState$6({
                showProvider: false,
                provider: "functions",
                search: "",
            });
            this.tokenAtCursor = undefined;
            // we can't allow input events to be triggered while we remove and add back the content of the composer in processContent
            this.shouldProcessInputEvents = false;
            // a composer edits a single cell. After that, it is done and should not
            // modify the model anymore.
            this.isDone = false;
            this.refSelectionStart = 0;
            this.tokens = [];
            this.keyMapping = {
                Enter: this.processEnterKey,
                Escape: this.processEscapeKey,
                Tab: (ev) => this.processTabKey(ev),
                F2: () => console.warn("Not implemented"),
                F4: () => console.warn("Not implemented"),
                ArrowUp: this.processArrowKeys,
                ArrowDown: this.processArrowKeys,
                ArrowLeft: this.processArrowKeys,
                ArrowRight: this.processArrowKeys,
            };
            this.contentHelper = new ContentEditableHelper(this.composerRef.el);
            const [col, row] = this.getters.getPosition();
            this.zone = this.getters.expandZone({ left: col, right: col, top: row, bottom: row });
            this.rect = this.getters.getRect(this.zone, this.props.viewport);
        }
        mounted() {
            DEBUG.composer = this;
            const el = this.composerRef.el;
            this.contentHelper.updateEl(el);
            const currentContent = this.getters.getCurrentContent();
            if (currentContent) {
                this.contentHelper.insertText(currentContent);
                this.contentHelper.selectRange(currentContent.length, currentContent.length);
            }
            this.processContent();
            el.style.width = (Math.max(el.scrollWidth + 10, this.rect[2] + 0.5) + "px");
            el.style.height = (this.rect[3] + 0.5 + "px");
        }
        willUnmount() {
            delete DEBUG.composer;
            this.trigger("composer-unmounted");
        }
        get containerStyle() {
            const style = this.getters.getCurrentStyle();
            const [x, y, , height] = this.rect;
            const weight = `font-weight:${style.bold ? "bold" : 500};`;
            const italic = style.italic ? `font-style: italic;` : ``;
            const strikethrough = style.strikethrough ? `text-decoration:line-through;` : ``;
            return `left: ${x - 1}px;
        top:${y}px;
        height:${height}px;
        font-size:${fontSizeMap[style.fontSize || 10]}px;
        ${weight}${italic}${strikethrough}`;
        }
        get composerStyle() {
            const style = this.getters.getCurrentStyle();
            const cell = this.getters.getActiveCell() || { type: "text" };
            const height = this.rect[3];
            const align = "align" in style ? style.align : cell.type === "number" ? "right" : "left";
            return `text-align:${align};
        line-height:${height - 1.5}px;`;
        }
        // ---------------------------------------------------------------------------
        // Handlers
        // ---------------------------------------------------------------------------
        processArrowKeys(ev) {
            if (this.getters.getEditionMode() === "selecting") {
                ev.preventDefault();
                return;
            }
            ev.stopPropagation();
            const autoCompleteComp = this.autoCompleteRef.comp;
            if (["ArrowUp", "ArrowDown"].includes(ev.key) &&
                this.autoCompleteState.showProvider &&
                autoCompleteComp) {
                ev.preventDefault();
                if (ev.key === "ArrowUp") {
                    autoCompleteComp.moveUp();
                }
                else {
                    autoCompleteComp.moveDown();
                }
            }
        }
        processTabKey(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            const autoCompleteComp = this.autoCompleteRef.comp;
            if (this.autoCompleteState.showProvider && autoCompleteComp) {
                const autoCompleteValue = autoCompleteComp.getValueToFill();
                if (autoCompleteValue) {
                    this.autoComplete(autoCompleteValue);
                    return;
                }
            }
            else {
                // when completing with tab, if there is no value to complete, the active cell will be moved to the right.
                // we can't let the model think that it is for a ref selection.
                // todo: check if this can be removed someday
                this.dispatch("STOP_COMPOSER_SELECTION");
            }
            const deltaX = ev.shiftKey ? -1 : 1;
            this.isDone = true;
            this.dispatch("MOVE_POSITION", { deltaX, deltaY: 0 });
        }
        processEnterKey(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            const autoCompleteComp = this.autoCompleteRef.comp;
            if (this.autoCompleteState.showProvider && autoCompleteComp) {
                const autoCompleteValue = autoCompleteComp.getValueToFill();
                if (autoCompleteValue) {
                    this.autoComplete(autoCompleteValue);
                    return;
                }
            }
            this.dispatch("STOP_EDITION");
            this.dispatch("MOVE_POSITION", {
                deltaX: 0,
                deltaY: ev.shiftKey ? -1 : 1,
            });
            this.isDone = true;
        }
        processEscapeKey() {
            this.dispatch("STOP_EDITION", { cancel: true });
            this.isDone = true;
        }
        onKeydown(ev) {
            let handler = this.keyMapping[ev.key];
            if (handler) {
                return handler.call(this, ev);
            }
            ev.stopPropagation();
        }
        /*
         * Triggered automatically by the content-editable between the keydown and key up
         * */
        onInput(ev) {
            if (this.isDone || !this.shouldProcessInputEvents) {
                return;
            }
            const el = this.composerRef.el;
            if (el.clientWidth !== el.scrollWidth) {
                el.style.width = `${el.scrollWidth + 20}px`;
            }
            const content = el.childNodes.length ? el.textContent : "";
            this.dispatch("SET_CURRENT_CONTENT", { content });
        }
        onKeyup(ev) {
            if (this.isDone ||
                [
                    "Control",
                    "Shift",
                    "ArrowUp",
                    "ArrowDown",
                    "ArrowLeft",
                    "ArrowRight",
                    "Tab",
                    "Enter",
                ].includes(ev.key)) {
                // already processed in keydown
                return;
            }
            ev.preventDefault();
            ev.stopPropagation();
            // reset the state of the ref selector and autocomplete for safety.
            // They will be set correctly if needed in `processTokenAtCursor`
            this.autoCompleteState.showProvider = false;
            this.autoCompleteState.search = "";
            this.dispatch("STOP_COMPOSER_SELECTION");
            if (ev.ctrlKey && ev.key === " ") {
                this.autoCompleteState.showProvider = true;
            }
            else {
                this.processContent();
                this.processTokenAtCursor();
            }
        }
        onClick(ev) {
            ev.stopPropagation();
            this.processContent();
            this.processTokenAtCursor();
        }
        onCompleted(ev) {
            this.autoComplete(ev.detail.text);
        }
        // ---------------------------------------------------------------------------
        // Private
        // ---------------------------------------------------------------------------
        processContent() {
            this.shouldProcessInputEvents = false;
            let value = this.getters.getCurrentContent();
            this.tokenAtCursor = undefined;
            if (value.startsWith("=")) {
                this.saveSelection();
                this.contentHelper.removeAll(); // remove the content of the composer, to be added just after
                this.contentHelper.selectRange(0, 0); // move the cursor inside the composer at 0 0.
                this.dispatch("REMOVE_ALL_HIGHLIGHTS"); //cleanup highlights for references
                const refUsed = {};
                let lastUsedColorIndex = 0;
                this.tokens = composerTokenize(value);
                if (this.selectionStart === this.selectionEnd && this.selectionEnd === 0) {
                    this.tokenAtCursor = undefined;
                }
                else {
                    this.tokenAtCursor = this.tokens.find((t) => t.start <= this.selectionStart && t.end >= this.selectionEnd);
                }
                for (let token of this.tokens) {
                    switch (token.type) {
                        case "OPERATOR":
                        case "NUMBER":
                        case "FUNCTION":
                        case "COMMA":
                        case "BOOLEAN":
                            this.contentHelper.insertText(token.value, tokenColor[token.type]);
                            break;
                        case "SYMBOL":
                            let value = token.value;
                            const [xc, sheet] = value.split("!").reverse();
                            if (rangeReference.test(xc)) {
                                const refSanitized = getComposerSheetName(sheet
                                    ? `${sheet}`
                                    : `${this.getters.getSheetName(this.getters.getEditionSheet())}`) +
                                    "!" +
                                    xc.replace(/\$/g, "");
                                if (!refUsed[refSanitized]) {
                                    refUsed[refSanitized] = colors[lastUsedColorIndex];
                                    lastUsedColorIndex = ++lastUsedColorIndex % colors.length;
                                }
                                this.contentHelper.insertText(value, refUsed[refSanitized]);
                            }
                            else {
                                this.contentHelper.insertText(value);
                            }
                            break;
                        case "LEFT_PAREN":
                        case "RIGHT_PAREN":
                            // Compute the matching parenthesis
                            if (this.tokenAtCursor &&
                                ["LEFT_PAREN", "RIGHT_PAREN"].includes(this.tokenAtCursor.type) &&
                                this.tokenAtCursor.parenIndex &&
                                this.tokenAtCursor.parenIndex === token.parenIndex) {
                                this.contentHelper.insertText(token.value, MatchingParenColor);
                            }
                            else {
                                this.contentHelper.insertText(token.value);
                            }
                            break;
                        default:
                            this.contentHelper.insertText(token.value);
                            break;
                    }
                }
                // Put the cursor back where it was
                this.contentHelper.selectRange(this.selectionStart, this.selectionEnd);
                if (Object.keys(refUsed).length) {
                    this.dispatch("ADD_HIGHLIGHTS", { ranges: refUsed });
                }
            }
            this.shouldProcessInputEvents = true;
        }
        /**
         * Compute the state of the composer from the tokenAtCursor.
         * If the token is a bool, function or symbol we have to initialize the autocomplete engine.
         * If it's a comma, left_paren or operator we have to initialize the range selection.
         */
        processTokenAtCursor() {
            if (!this.tokenAtCursor) {
                return;
            }
            if (["BOOLEAN", "FUNCTION", "SYMBOL"].includes(this.tokenAtCursor.type)) {
                if (this.tokenAtCursor.value.length > 0) {
                    this.autoCompleteState.search = this.tokenAtCursor.value;
                    this.autoCompleteState.showProvider = true;
                }
            }
            else if (["COMMA", "LEFT_PAREN", "OPERATOR", "SPACE"].includes(this.tokenAtCursor.type)) {
                // we need to reset the anchor of the selection to the active cell, so the next Arrow key down
                // is relative the to the cell we edit
                this.dispatch("START_COMPOSER_SELECTION");
                // We set this variable to store the start of the selection, to allow
                // to replace selections (ex: select twice a cell should only be added
                // once)
                this.refSelectionStart = this.selectionStart;
            }
        }
        addText(text) {
            this.contentHelper.selectRange(this.selectionStart, this.selectionEnd);
            this.contentHelper.insertText(text);
            this.selectionStart = this.selectionEnd = this.selectionStart + text.length;
            this.contentHelper.selectRange(this.selectionStart, this.selectionEnd);
        }
        addTextFromSelection() {
            const zone = this.getters.getSelectedZones()[0];
            let selection = this.getters.zoneToXC(zone);
            if (this.refSelectionStart) {
                this.selectionStart = this.refSelectionStart;
            }
            if (this.getters.getEditionSheet() !== this.getters.getActiveSheet()) {
                const sheetName = getComposerSheetName(this.getters.getSheetName(this.getters.getActiveSheet()));
                selection = `${sheetName}!${selection}`;
            }
            this.addText(selection);
            this.processContent();
        }
        autoComplete(value) {
            this.saveSelection();
            if (value) {
                if (this.tokenAtCursor) {
                    let start = this.tokenAtCursor.end;
                    let end = this.tokenAtCursor.end;
                    if (["SYMBOL", "FUNCTION"].includes(this.tokenAtCursor.type)) {
                        start = this.tokenAtCursor.start;
                    }
                    if (this.autoCompleteState.provider && this.tokens.length) {
                        value += "(";
                        const currentTokenIndex = this.tokens
                            .map((token) => token.start)
                            .indexOf(this.tokenAtCursor.start);
                        if (currentTokenIndex + 1 < this.tokens.length) {
                            const nextToken = this.tokens[currentTokenIndex + 1];
                            if (nextToken.type === "LEFT_PAREN") {
                                end++;
                            }
                        }
                    }
                    this.selectionStart = start;
                    this.selectionEnd = end;
                }
                this.addText(value);
            }
            this.autoCompleteState.search = "";
            this.autoCompleteState.showProvider = false;
            this.processContent();
            this.processTokenAtCursor();
        }
        /**
         * Save the current selection
         */
        saveSelection() {
            const selection = this.contentHelper.getCurrentSelection();
            this.selectionStart = selection.start;
            this.selectionEnd = selection.end;
        }
    }
    Composer.template = TEMPLATE$4;
    Composer.style = CSS$4;
    Composer.components = { TextValueProvider };

    const { xml: xml$5, css: css$5 } = owl__namespace.tags;
    const { useState: useState$5 } = owl__namespace;
    const TEMPLATE$3 = xml$5 /* xml */ `<div>
    <t t-foreach="getFigures()" t-as="info" t-key="info.id">
        <div class="o-figure-wrapper"
             t-att-style="getStyle(info)"
             t-on-mousedown="onMouseDown(info.figure)"
             >
            <div class="o-figure"
                 t-att-class="{active: info.isSelected, 'o-dragging': info.id === dnd.figureId}"
                 t-att-style="getDims(info)"
                 tabindex="0"
                 t-on-keydown.stop="onKeyDown(info.figure)">
                <t t-component="figureRegistry.get(info.figure.tag).Component"
                   t-key="info.id"
                   figure="info.figure"/>
                <t t-if="info.isSelected">
                    <div class="o-anchor o-top" t-on-mousedown.stop="resize(info.figure, 0,-1)"/>
                    <div class="o-anchor o-topRight" t-on-mousedown.stop="resize(info.figure, 1,-1)"/>
                    <div class="o-anchor o-right" t-on-mousedown.stop="resize(info.figure, 1,0)"/>
                    <div class="o-anchor o-bottomRight" t-on-mousedown.stop="resize(info.figure, 1,1)"/>
                    <div class="o-anchor o-bottom" t-on-mousedown.stop="resize(info.figure, 0,1)"/>
                    <div class="o-anchor o-bottomLeft" t-on-mousedown.stop="resize(info.figure, -1,1)"/>
                    <div class="o-anchor o-left" t-on-mousedown.stop="resize(info.figure, -1,0)"/>
                    <div class="o-anchor o-topLeft" t-on-mousedown.stop="resize(info.figure, -1,-1)"/>
                </t>
            </div>
        </div>
    </t>
</div>
`;
    // -----------------------------------------------------------------------------
    // STYLE
    // -----------------------------------------------------------------------------
    const ANCHOR_SIZE = 8;
    const BORDER_WIDTH = 1;
    const ACTIVE_BORDER_WIDTH = 2;
    const MIN_FIG_SIZE = 80;
    const CSS$3 = css$5 /*SCSS*/ `
  .o-figure-wrapper {
    overflow: hidden;
  }

  .o-figure {
    border: 1px solid black;
    box-sizing: border-box;
    position: absolute;
    bottom: 3px;
    right: 3px;
    &:focus {
      outline: none;
    }
    &.active {
      border: ${ACTIVE_BORDER_WIDTH}px solid ${SELECTION_BORDER_COLOR};
      z-index: 1;
    }

    &.o-dragging {
      opacity: 0.9;
      cursor: grabbing;
    }

    .o-anchor {
      z-index: 1000;
      position: absolute;
      outline: ${BORDER_WIDTH}px solid white;
      width: ${ANCHOR_SIZE}px;
      height: ${ANCHOR_SIZE}px;
      background-color: #1a73e8;
      &.o-top {
        top: -${ANCHOR_SIZE / 2}px;
        right: 50%;
        cursor: n-resize;
      }
      &.o-topRight {
        top: -${ANCHOR_SIZE / 2}px;
        right: -${ANCHOR_SIZE / 2}px;
        cursor: ne-resize;
      }
      &.o-right {
        right: -${ANCHOR_SIZE / 2}px;
        top: 50%;
        cursor: e-resize;
      }
      &.o-bottomRight {
        bottom: -${ANCHOR_SIZE / 2}px;
        right: -${ANCHOR_SIZE / 2}px;
        cursor: se-resize;
      }
      &.o-bottom {
        bottom: -${ANCHOR_SIZE / 2}px;
        right: 50%;
        cursor: s-resize;
      }
      &.o-bottomLeft {
        bottom: -${ANCHOR_SIZE / 2}px;
        left: -${ANCHOR_SIZE / 2}px;
        cursor: sw-resize;
      }
      &.o-left {
        bottom: 50%;
        left: -${ANCHOR_SIZE / 2}px;
        cursor: w-resize;
      }
      &.o-topLeft {
        top: -${ANCHOR_SIZE / 2}px;
        left: -${ANCHOR_SIZE / 2}px;
        cursor: nw-resize;
      }
    }
  }
`;
    class FiguresContainer extends owl.Component {
        constructor() {
            super(...arguments);
            this.figureRegistry = figureRegistry;
            this.dnd = useState$5({
                figureId: "",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
            });
            this.getters = this.env.getters;
            this.dispatch = this.env.dispatch;
        }
        getFigures() {
            const selectedId = this.getters.getSelectedFigureId();
            return this.getters.getFigures(this.props.viewport).map((f) => ({
                id: f.id,
                isSelected: f.id === selectedId,
                figure: f,
            }));
        }
        getDims(info) {
            const { figure, isSelected } = info;
            const borders = 2 * (isSelected ? ACTIVE_BORDER_WIDTH : BORDER_WIDTH);
            const { width, height } = isSelected && this.dnd.figureId ? this.dnd : figure;
            return `width:${width + borders}px;height:${height + borders}px`;
        }
        getStyle(info) {
            const { figure, isSelected } = info;
            const { offsetX, offsetY } = this.props.viewport;
            const target = figure.id === (isSelected && this.dnd.figureId) ? this.dnd : figure;
            const { width, height } = target;
            let x = target.x - offsetX + HEADER_WIDTH - 1;
            let y = target.y - offsetY + HEADER_HEIGHT - 1;
            // width and height of wrapper need to be adjusted so we do not overlap
            // with headers
            const correctionX = Math.max(0, HEADER_WIDTH - x);
            x += correctionX;
            const correctionY = Math.max(0, HEADER_HEIGHT - y);
            y += correctionY;
            if (width < 0 || height < 0) {
                return `position:absolute;display:none;`;
            }
            const offset = ANCHOR_SIZE + ACTIVE_BORDER_WIDTH + (isSelected ? ACTIVE_BORDER_WIDTH : BORDER_WIDTH);
            return `position:absolute; top:${y + 1}px; left:${x + 1}px; width:${width - correctionX + offset}px; height:${height - correctionY + offset}px`;
        }
        mounted() {
            // horrible, but necessary
            // the following line ensures that we render the figures with the correct
            // viewport.  The reason is that whenever we initialize the grid
            // component, we do not know yet the actual size of the viewport, so the
            // first owl rendering is done with an empty viewport.  Only then we can
            // compute which figures should be displayed, so we have to force a
            // new rendering
            this.render();
        }
        resize(figure, dirX, dirY, ev) {
            ev.stopPropagation();
            const initialX = ev.clientX;
            const initialY = ev.clientY;
            this.dnd.figureId = figure.id;
            this.dnd.x = figure.x;
            this.dnd.y = figure.y;
            this.dnd.width = figure.width;
            this.dnd.height = figure.height;
            const onMouseMove = (ev) => {
                const deltaX = dirX * (ev.clientX - initialX);
                const deltaY = dirY * (ev.clientY - initialY);
                this.dnd.width = Math.max(figure.width + deltaX, MIN_FIG_SIZE);
                this.dnd.height = Math.max(figure.height + deltaY, MIN_FIG_SIZE);
                if (dirX < 0) {
                    this.dnd.x = figure.x - deltaX;
                }
                if (dirY < 0) {
                    this.dnd.y = figure.y - deltaY;
                }
            };
            const onMouseUp = (ev) => {
                this.dnd.figureId = "";
                const update = { id: figure.id, x: this.dnd.x, y: this.dnd.y };
                if (dirX) {
                    update.width = this.dnd.width;
                }
                if (dirY) {
                    update.height = this.dnd.height;
                }
                this.dispatch("UPDATE_FIGURE", update);
            };
            startDnd(onMouseMove, onMouseUp);
        }
        onMouseDown(figure, ev) {
            if (ev.button > 0) {
                // not main button, probably a context menu
                return;
            }
            this.dispatch("SELECT_FIGURE", { id: figure.id });
            const initialX = ev.clientX;
            const initialY = ev.clientY;
            this.dnd.figureId = figure.id;
            this.dnd.x = figure.x;
            this.dnd.y = figure.y;
            this.dnd.width = figure.width;
            this.dnd.height = figure.height;
            const onMouseMove = (ev) => {
                this.dnd.x = Math.max(figure.x - initialX + ev.clientX, 0);
                this.dnd.y = Math.max(figure.y - initialY + ev.clientY, 0);
            };
            const onMouseUp = (ev) => {
                this.dnd.figureId = "";
                this.dispatch("UPDATE_FIGURE", { id: figure.id, x: this.dnd.x, y: this.dnd.y });
            };
            startDnd(onMouseMove, onMouseUp);
        }
        onKeyDown(figure, ev) {
            switch (ev.key) {
                case "Delete":
                    ev.preventDefault();
                    this.dispatch("DELETE_FIGURE", { id: figure.id });
                    this.trigger("figure-deleted");
                    break;
            }
        }
    }
    FiguresContainer.template = TEMPLATE$3;
    FiguresContainer.style = CSS$3;
    FiguresContainer.components = {};

    const Component$4 = owl__namespace.Component;
    const { xml: xml$4, css: css$4 } = owl__namespace.tags;
    const { useState: useState$4 } = owl__namespace.hooks;
    // -----------------------------------------------------------------------------
    // Resizer component
    // -----------------------------------------------------------------------------
    class AbstractResizer extends Component$4 {
        constructor() {
            super(...arguments);
            this.PADDING = 0;
            this.MAX_SIZE_MARGIN = 0;
            this.MIN_ELEMENT_SIZE = 0;
            this.lastSelectedElement = null;
            this.lastElement = null;
            this.getters = this.env.getters;
            this.dispatch = this.env.dispatch;
            this.state = useState$4({
                isActive: false,
                isResizing: false,
                activeElement: 0,
                styleValue: 0,
                delta: 0,
            });
        }
        _computeHandleDisplay(ev) {
            const index = this._getEvOffset(ev);
            const elementIndex = this._getElementIndex(index);
            if (elementIndex < 0) {
                return;
            }
            const element = this._getElement(elementIndex);
            const offset = this._getStateOffset();
            if (index - (element.start - offset) < this.PADDING &&
                elementIndex !== this._getViewportOffset()) {
                this.state.isActive = true;
                this.state.styleValue = element.start - offset - this._getHeaderSize();
                this.state.activeElement = elementIndex - 1;
            }
            else if (element.end - offset - index < this.PADDING) {
                this.state.isActive = true;
                this.state.styleValue = element.end - offset - this._getHeaderSize();
                this.state.activeElement = elementIndex;
            }
            else {
                this.state.isActive = false;
            }
        }
        onMouseMove(ev) {
            if (this.state.isResizing) {
                return;
            }
            this._computeHandleDisplay(ev);
        }
        onMouseLeave() {
            this.state.isActive = this.state.isResizing;
        }
        onDblClick() {
            this._fitElementSize(this.state.activeElement);
            this.state.isResizing = false;
        }
        onMouseDown(ev) {
            this.state.isResizing = true;
            this.state.delta = 0;
            const initialIndex = this._getClientPosition(ev);
            const styleValue = this.state.styleValue;
            const size = this._getElement(this.state.activeElement).size;
            const minSize = styleValue - size + this.MIN_ELEMENT_SIZE;
            const maxSize = this._getMaxSize();
            const onMouseUp = (ev) => {
                this.state.isResizing = false;
                if (this.state.delta !== 0) {
                    this._updateSize();
                }
            };
            const onMouseMove = (ev) => {
                this.state.delta = this._getClientPosition(ev) - initialIndex;
                this.state.styleValue = styleValue + this.state.delta;
                if (this.state.styleValue < minSize) {
                    this.state.styleValue = minSize;
                    this.state.delta = this.MIN_ELEMENT_SIZE - size;
                }
                if (this.state.styleValue > maxSize) {
                    this.state.styleValue = maxSize;
                    this.state.delta = maxSize - styleValue;
                }
            };
            startDnd(onMouseMove, onMouseUp);
        }
        select(ev) {
            if (ev.button > 0) {
                // not main button, probably a context menu
                return;
            }
            const index = this._getElementIndex(this._getEvOffset(ev));
            if (index < 0) {
                return;
            }
            this.lastElement = index;
            this.dispatch(ev.ctrlKey ? "START_SELECTION_EXPANSION" : "START_SELECTION");
            if (ev.shiftKey) {
                this._increaseSelection(index);
            }
            else {
                this.lastSelectedElement = index;
                this._selectElement(index, ev.ctrlKey);
            }
            const initialIndex = this._getClientPosition(ev);
            const initialOffset = this._getEvOffset(ev);
            const onMouseMoveSelect = (ev) => {
                const offset = this._getClientPosition(ev) - initialIndex + initialOffset;
                const index = this._getElementIndex(offset);
                if (index !== this.lastElement && index !== -1) {
                    this._increaseSelection(index);
                    this.lastElement = index;
                }
            };
            const onMouseUpSelect = () => {
                this.lastElement = null;
                this.dispatch(ev.ctrlKey ? "PREPARE_SELECTION_EXPANSION" : "STOP_SELECTION");
            };
            startDnd(onMouseMoveSelect, onMouseUpSelect);
        }
        onMouseUp(ev) {
            this.lastElement = null;
        }
        onContextMenu(ev) {
            ev.preventDefault();
            const index = this._getElementIndex(this._getEvOffset(ev));
            if (index < 0)
                return;
            if (!this._getActiveElements().has(index)) {
                this.lastSelectedElement = index;
                this._selectElement(index, false);
            }
            const type = this._getType();
            const { x, y } = this._getXY(ev);
            this.trigger("open-contextmenu", { type, x, y });
        }
    }
    class ColResizer extends AbstractResizer {
        constructor() {
            super(...arguments);
            this.PADDING = 15;
            this.MAX_SIZE_MARGIN = 90;
            this.MIN_ELEMENT_SIZE = MIN_COL_WIDTH;
        }
        _getEvOffset(ev) {
            return ev.offsetX + HEADER_WIDTH;
        }
        _getStateOffset() {
            return this.props.viewport.offsetX - HEADER_WIDTH;
        }
        _getViewportOffset() {
            return this.props.viewport.left;
        }
        _getClientPosition(ev) {
            return ev.clientX;
        }
        _getElementIndex(index) {
            return this.getters.getColIndex(index, this.props.viewport.left);
        }
        _getElement(index) {
            return this.getters.getCol(this.getters.getActiveSheet(), index);
        }
        _getBottomRightValue(element) {
            return element.end;
        }
        _getHeaderSize() {
            return HEADER_WIDTH;
        }
        _getMaxSize() {
            return this.el.clientWidth;
        }
        _updateSize() {
            const index = this.state.activeElement;
            const size = this.state.delta + this._getElement(index).size;
            const cols = this.getters.getActiveCols();
            this.dispatch("RESIZE_COLUMNS", {
                sheet: this.getters.getActiveSheet(),
                cols: cols.has(index) ? [...cols] : [index],
                size,
            });
        }
        _selectElement(index, ctrlKey) {
            this.dispatch("SELECT_COLUMN", { index, createRange: ctrlKey });
        }
        _increaseSelection(index) {
            this.dispatch("SELECT_COLUMN", { index, updateRange: true });
        }
        _fitElementSize(index) {
            const cols = this.getters.getActiveCols();
            this.dispatch("AUTORESIZE_COLUMNS", {
                sheet: this.getters.getActiveSheet(),
                cols: cols.has(index) ? [...cols] : [index],
            });
        }
        _getType() {
            return "COL";
        }
        _getActiveElements() {
            return this.getters.getActiveCols();
        }
        _getXY(ev) {
            return {
                x: ev.offsetX + HEADER_WIDTH,
                y: ev.offsetY,
            };
        }
    }
    ColResizer.template = xml$4 /* xml */ `
    <div class="o-col-resizer" t-on-mousemove.self="onMouseMove" t-on-mouseleave="onMouseLeave" t-on-mousedown.self.prevent="select"
      t-on-mouseup.self="onMouseUp" t-on-contextmenu.self="onContextMenu">
      <t t-if="state.isActive">
        <div class="o-handle" t-on-mousedown="onMouseDown" t-on-dblclick="onDblClick" t-on-contextmenu.prevent=""
          t-attf-style="left:{{state.styleValue - 2}}px;">
          <div class="dragging" t-if="state.isResizing"/>
        </div>
      </t>
    </div>`;
    ColResizer.style = css$4 /* scss */ `
    .o-col-resizer {
      position: absolute;
      top: 0;
      left: ${HEADER_WIDTH}px;
      right: 0;
      height: ${HEADER_HEIGHT}px;
      .o-handle {
        position: absolute;
        height: ${HEADER_HEIGHT}px;
        width: 4px;
        cursor: e-resize;
        background-color: #3266ca;
      }
      .dragging {
        top: ${HEADER_HEIGHT}px;
        position: absolute;
        margin-left: 2px;
        width: 1px;
        height: 10000px;
        background-color: #3266ca;
      }
    }
  `;
    class RowResizer extends AbstractResizer {
        constructor() {
            super(...arguments);
            this.PADDING = 5;
            this.MAX_SIZE_MARGIN = 60;
            this.MIN_ELEMENT_SIZE = MIN_ROW_HEIGHT;
        }
        _getEvOffset(ev) {
            return ev.offsetY + HEADER_HEIGHT;
        }
        _getStateOffset() {
            return this.props.viewport.offsetY - HEADER_HEIGHT;
        }
        _getViewportOffset() {
            return this.props.viewport.top;
        }
        _getClientPosition(ev) {
            return ev.clientY;
        }
        _getElementIndex(index) {
            return this.getters.getRowIndex(index, this.props.viewport.top);
        }
        _getElement(index) {
            return this.getters.getRow(this.getters.getActiveSheet(), index);
        }
        _getHeaderSize() {
            return HEADER_HEIGHT;
        }
        _getMaxSize() {
            return this.el.clientHeight;
        }
        _updateSize() {
            const index = this.state.activeElement;
            const size = this.state.delta + this._getElement(index).size;
            const rows = this.getters.getActiveRows();
            this.dispatch("RESIZE_ROWS", {
                sheet: this.getters.getActiveSheet(),
                rows: rows.has(index) ? [...rows] : [index],
                size,
            });
        }
        _selectElement(index, ctrlKey) {
            this.dispatch("SELECT_ROW", { index, createRange: ctrlKey });
        }
        _increaseSelection(index) {
            this.dispatch("SELECT_ROW", { index, updateRange: true });
        }
        _fitElementSize(index) {
            const rows = this.getters.getActiveRows();
            this.dispatch("AUTORESIZE_ROWS", {
                sheet: this.getters.getActiveSheet(),
                rows: rows.has(index) ? [...rows] : [index],
            });
        }
        _getType() {
            return "ROW";
        }
        _getActiveElements() {
            return this.getters.getActiveRows();
        }
        _getXY(ev) {
            return {
                x: ev.offsetX,
                y: ev.offsetY + HEADER_HEIGHT,
            };
        }
    }
    RowResizer.template = xml$4 /* xml */ `
    <div class="o-row-resizer" t-on-mousemove.self="onMouseMove"  t-on-mouseleave="onMouseLeave" t-on-mousedown.self.prevent="select"
    t-on-mouseup.self="onMouseUp" t-on-contextmenu.self="onContextMenu">
      <t t-if="state.isActive">
        <div class="o-handle" t-on-mousedown="onMouseDown" t-on-dblclick="onDblClick" t-on-contextmenu.prevent=""
          t-attf-style="top:{{state.styleValue - 2}}px;">
          <div class="dragging" t-if="state.isResizing"/>
        </div>
      </t>
    </div>`;
    RowResizer.style = css$4 /* scss */ `
    .o-row-resizer {
      position: absolute;
      top: ${HEADER_HEIGHT}px;
      left: 0;
      right: 0;
      width: ${HEADER_WIDTH}px;
      height: 100%;
      .o-handle {
        position: absolute;
        height: 4px;
        width: ${HEADER_WIDTH}px;
        cursor: n-resize;
        background-color: #3266ca;
      }
      .dragging {
        left: ${HEADER_WIDTH}px;
        position: absolute;
        margin-top: 2px;
        width: 10000px;
        height: 1px;
        background-color: #3266ca;
      }
    }
  `;
    class Overlay extends Component$4 {
        selectAll() {
            this.env.dispatch("SELECT_ALL");
        }
    }
    Overlay.template = xml$4 /* xml */ `
    <div class="o-overlay">
      <ColResizer viewport="props.viewport"/>
      <RowResizer viewport="props.viewport"/>
      <div class="all" t-on-mousedown.self="selectAll"/>
    </div>`;
    Overlay.style = css$4 /* scss */ `
    .o-overlay {
      .all {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        width: ${HEADER_WIDTH}px;
        height: ${HEADER_HEIGHT}px;
      }
    }
  `;
    Overlay.components = { ColResizer, RowResizer };

    class ScrollBar {
        constructor(el, direction) {
            this.el = el;
            this.direction = direction;
        }
        get scroll() {
            return this.direction === "horizontal" ? this.el.scrollLeft : this.el.scrollTop;
        }
        set scroll(value) {
            if (this.direction === "horizontal") {
                this.el.scrollLeft = value;
            }
            else {
                this.el.scrollTop = value;
            }
        }
    }

    /**
     * The Grid component is the main part of the spreadsheet UI. It is responsible
     * for displaying the actual grid, rendering it, managing events, ...
     *
     * The grid is rendered on a canvas. 3 sub components are (sometimes) displayed
     * on top of the canvas:
     * - a composer (to edit the cell content)
     * - a horizontal resizer (to resize columns)
     * - a vertical resizer (same, for rows)
     */
    const { useState: useState$3 } = owl__namespace;
    const Component$3 = owl__namespace.Component;
    const { xml: xml$3, css: css$3 } = owl__namespace.tags;
    const { useRef: useRef$2, onMounted, onWillUnmount } = owl__namespace.hooks;
    const registries$1 = {
        ROW: rowMenuRegistry,
        COL: colMenuRegistry,
        CELL: cellMenuRegistry,
    };
    // copy and paste are specific events that should not be managed by the keydown event,
    // but they shouldn't be preventDefault and stopped (else copy and paste events will not trigger)
    // and also should not result in typing the character C or V in the composer
    const keyDownMappingIgnore = ["CTRL+C", "CTRL+V"];
    function useErrorTooltip(env, getViewPort) {
        const { browser, getters } = env;
        const { Date, setInterval, clearInterval } = browser;
        let x = 0;
        let y = 0;
        let lastMoved = 0;
        let tooltipCol, tooltipRow;
        const canvasRef = useRef$2("canvas");
        const tooltip = useState$3({ isOpen: false, text: "", style: "" });
        let interval;
        function updateMousePosition(e) {
            x = e.offsetX;
            y = e.offsetY;
            lastMoved = Date.now();
        }
        function getPosition() {
            const viewport = getViewPort();
            const col = getters.getColIndex(x, viewport.left);
            const row = getters.getRowIndex(y, viewport.top);
            return [col, row];
        }
        function checkTiming() {
            if (tooltip.isOpen) {
                const [col, row] = getPosition();
                if (col !== tooltipCol || row !== tooltipRow) {
                    tooltip.isOpen = false;
                }
            }
            else {
                const delta = Date.now() - lastMoved;
                if (400 < delta && delta < 600) {
                    // mouse did not move for a short while
                    const [col, row] = getPosition();
                    if (col < 0 || row < 0) {
                        return;
                    }
                    const mainXc = getters.getMainCell(toXC(col, row));
                    const cell = getters.getCell(...toCartesian(mainXc));
                    if (cell && cell.error) {
                        tooltip.isOpen = true;
                        tooltip.text = cell.error;
                        tooltipCol = col;
                        tooltipRow = row;
                        const viewport = getViewPort();
                        const [x, y, width, height] = env.getters.getRect({ left: col, top: row, right: col, bottom: row }, viewport);
                        const hAlign = x + width + 200 < viewport.width ? "left" : "right";
                        const hOffset = hAlign === "left" ? x + width : viewport.width - x + (SCROLLBAR_WIDTH + 2);
                        const vAlign = y + 120 < viewport.height ? "top" : "bottom";
                        const vOffset = vAlign === "top" ? y : viewport.height - y - height + (SCROLLBAR_WIDTH + 2);
                        tooltip.style = `${hAlign}:${hOffset}px;${vAlign}:${vOffset}px`;
                    }
                }
            }
        }
        onMounted(() => {
            canvasRef.el.addEventListener("mousemove", updateMousePosition);
            interval = setInterval(checkTiming, 200);
        });
        onWillUnmount(() => {
            canvasRef.el.removeEventListener("mousemove", updateMousePosition);
            clearInterval(interval);
        });
        return tooltip;
    }
    function useTouchMove(handler, canMoveUp) {
        const canvasRef = useRef$2("canvas");
        let x = null;
        let y = null;
        function onTouchStart(ev) {
            if (ev.touches.length !== 1)
                return;
            x = ev.touches[0].clientX;
            y = ev.touches[0].clientY;
        }
        function onTouchEnd() {
            x = null;
            y = null;
        }
        function onTouchMove(ev) {
            if (ev.touches.length !== 1)
                return;
            // On mobile browsers, swiping down is often associated with "pull to refresh".
            // We only want this behavior if the grid is already at the top.
            // Otherwise we only want to move the canvas up, without triggering any refresh.
            if (canMoveUp()) {
                ev.preventDefault();
                ev.stopPropagation();
            }
            const currentX = ev.touches[0].clientX;
            const currentY = ev.touches[0].clientY;
            handler(x - currentX, y - currentY);
            x = currentX;
            y = currentY;
        }
        onMounted(() => {
            canvasRef.el.addEventListener("touchstart", onTouchStart);
            canvasRef.el.addEventListener("touchend", onTouchEnd);
            canvasRef.el.addEventListener("touchmove", onTouchMove);
        });
        onWillUnmount(() => {
            canvasRef.el.removeEventListener("touchstart", onTouchStart);
            canvasRef.el.removeEventListener("touchend", onTouchEnd);
            canvasRef.el.removeEventListener("touchmove", onTouchMove);
        });
    }
    // -----------------------------------------------------------------------------
    // TEMPLATE
    // -----------------------------------------------------------------------------
    const TEMPLATE$2 = xml$3 /* xml */ `
  <div class="o-grid" t-on-click="focus" t-on-keydown="onKeydown" t-on-wheel="onMouseWheel">
    <t t-if="getters.getEditionMode() !== 'inactive'">
      <Composer t-ref="composer" t-on-composer-unmounted="focus" viewport="snappedViewport"/>
    </t>
    <canvas t-ref="canvas"
      t-on-mousedown="onMouseDown"
      t-on-dblclick="onDoubleClick"
      tabindex="-1"
      t-on-contextmenu="onCanvasContextMenu"
       />
    <t t-if="errorTooltip.isOpen">
      <div class="o-error-tooltip" t-esc="errorTooltip.text" t-att-style="errorTooltip.style"/>
    </t>
    <t t-if="getters.getEditionMode() === 'inactive'">
      <Autofill position="getAutofillPosition()" viewport="snappedViewport"/>
    </t>
    <Overlay t-on-open-contextmenu="onOverlayContextMenu" viewport="snappedViewport"/>
    <Menu t-if="menuState.isOpen"
      menuItems="menuState.menuItems"
      position="menuState.position"
      t-on-close.stop="menuState.isOpen=false"/>
    <t t-set="gridSize" t-value="getters.getGridSize()"/>
    <FiguresContainer viewport="snappedViewport" model="props.model" t-on-figure-deleted="focus" />
    <div class="o-scrollbar vertical" t-on-scroll="onScroll" t-ref="vscrollbar">
      <div t-attf-style="width:1px;height:{{gridSize[1]}}px"/>
    </div>
    <div class="o-scrollbar horizontal" t-on-scroll="onScroll" t-ref="hscrollbar">
      <div t-attf-style="height:1px;width:{{gridSize[0]}}px"/>
    </div>
  </div>`;
    // -----------------------------------------------------------------------------
    // STYLE
    // -----------------------------------------------------------------------------
    const CSS$2 = css$3 /* scss */ `
  .o-grid {
    position: relative;
    overflow: hidden;
    background-color: ${BACKGROUND_GRAY_COLOR};

    > canvas {
      border-top: 1px solid #e2e3e3;
      border-bottom: 1px solid #e2e3e3;

      &:focus {
        outline: none;
      }
    }
    .o-error-tooltip {
      position: absolute;
      font-size: 13px;
      width: 180px;
      height: 80px;
      background-color: white;
      box-shadow: 0 1px 4px 3px rgba(60, 64, 67, 0.15);
      border-left: 3px solid red;
      padding: 10px;
    }
    .o-scrollbar {
      position: absolute;
      overflow: auto;
      z-index: 2;
      &.vertical {
        right: 0;
        top: ${HEADER_HEIGHT}px;
        bottom: ${SCROLLBAR_WIDTH}px;
        width: ${SCROLLBAR_WIDTH}px;
        overflow-x: hidden;
      }
      &.horizontal {
        bottom: 0;
        height: ${SCROLLBAR_WIDTH}px;
        right: ${SCROLLBAR_WIDTH + 1}px;
        left: ${HEADER_WIDTH}px;
        overflow-y: hidden;
      }
    }
  }
`;
    // -----------------------------------------------------------------------------
    // JS
    // -----------------------------------------------------------------------------
    class Grid extends Component$3 {
        constructor() {
            super(...arguments);
            this.menuState = useState$3({
                isOpen: false,
                position: null,
                menuItems: [],
            });
            this.composer = useRef$2("composer");
            this.vScrollbarRef = useRef$2("vscrollbar");
            this.hScrollbarRef = useRef$2("hscrollbar");
            this.canvas = useRef$2("canvas");
            this.getters = this.env.getters;
            this.dispatch = this.env.dispatch;
            this.currentPosition = this.getters.getPosition();
            this.currentSheet = this.getters.getActiveSheet();
            this.currentPositionInViewport = false;
            this.clickedCol = 0;
            this.clickedRow = 0;
            this.viewport = {
                width: 0,
                height: 0,
                offsetX: 0,
                offsetY: 0,
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
            };
            // this viewport represent the same area as the previous one, but 'snapped' to
            // the col/row structure, so, the offsets are correct for computations necessary
            // to align elements to the grid.
            this.snappedViewport = this.viewport;
            this.errorTooltip = useErrorTooltip(this.env, () => this.snappedViewport);
            // this map will handle most of the actions that should happen on key down. The arrow keys are managed in the key
            // down itself
            this.keyDownMapping = {
                ENTER: () => this.dispatch("START_EDITION"),
                TAB: () => this.dispatch("MOVE_POSITION", { deltaX: 1, deltaY: 0 }),
                "SHIFT+TAB": () => this.dispatch("MOVE_POSITION", { deltaX: -1, deltaY: 0 }),
                F2: () => this.dispatch("START_EDITION"),
                DELETE: () => {
                    this.dispatch("DELETE_CONTENT", {
                        sheet: this.getters.getActiveSheet(),
                        target: this.getters.getSelectedZones(),
                    });
                },
                "CTRL+A": () => this.dispatch("SELECT_ALL"),
                "CTRL+S": () => {
                    this.trigger("save-requested");
                },
                "CTRL+Z": () => this.dispatch("UNDO"),
                "CTRL+Y": () => this.dispatch("REDO"),
            };
            this.vScrollbar = new ScrollBar(this.vScrollbarRef.el, "vertical");
            this.hScrollbar = new ScrollBar(this.hScrollbarRef.el, "horizontal");
            useTouchMove(this.moveCanvas.bind(this), () => this.vScrollbar.scroll > 0);
        }
        mounted() {
            this.vScrollbar.el = this.vScrollbarRef.el;
            this.hScrollbar.el = this.hScrollbarRef.el;
            this.focus();
            this.drawGrid();
        }
        async willUpdateProps() {
            const sheet = this.getters.getActiveSheet();
            if (this.currentSheet !== sheet) {
                // We need to reset the viewport as the sheet is changed
                this.currentPositionInViewport = true;
                this.viewport.offsetX = 0;
                this.viewport.offsetY = 0;
                this.hScrollbar.scroll = 0;
                this.vScrollbar.scroll = 0;
                this.viewport = this.getters.adjustViewportZone(this.viewport);
                this.viewport = this.getters.adjustViewportPosition(this.viewport);
                this.snappedViewport = this.getters.snapViewportToCell(this.viewport);
            }
        }
        patched() {
            this.drawGrid();
        }
        focus() {
            if (this.getters.getEditionMode() !== "selecting" && !this.getters.getSelectedFigureId()) {
                this.canvas.el.focus();
            }
        }
        onScroll() {
            this.viewport.offsetX = this.hScrollbar.scroll;
            this.viewport.offsetY = this.vScrollbar.scroll;
            const viewport = this.getters.adjustViewportZone(this.viewport);
            if (!isEqual(viewport, this.viewport)) {
                this.viewport = viewport;
                this.render();
            }
            this.snappedViewport = this.getters.snapViewportToCell(this.viewport);
        }
        checkChanges() {
            const [col, row] = this.getters.getPosition();
            const [curCol, curRow] = this.currentPosition;
            const currentSheet = this.getters.getActiveSheet();
            const changed = currentSheet !== this.currentSheet || col !== curCol || row !== curRow;
            if (changed) {
                this.currentPosition = [col, row];
            }
            if (currentSheet !== this.currentSheet) {
                this.focus();
                this.currentSheet = currentSheet;
            }
            return changed;
        }
        getAutofillPosition() {
            const zone = this.getters.getSelectedZone();
            const sheet = this.getters.getActiveSheet();
            return {
                left: this.getters.getCol(sheet, zone.right).end -
                    4 +
                    HEADER_WIDTH -
                    this.snappedViewport.offsetX,
                top: this.getters.getRow(sheet, zone.bottom).end -
                    4 +
                    HEADER_HEIGHT -
                    this.snappedViewport.offsetY,
            };
        }
        drawGrid() {
            // update viewport dimensions
            // resize window
            this.viewport.width = this.el.clientWidth - SCROLLBAR_WIDTH;
            this.viewport.height = this.el.clientHeight - SCROLLBAR_WIDTH;
            // scrollbar scrolled
            this.viewport.offsetX = this.hScrollbar.scroll;
            this.viewport.offsetY = this.vScrollbar.scroll;
            // needed to reset the bottom and the right on the current viewport to the one of the new
            // active sheet or in any case, the number of cols & rows might have changed.
            this.viewport = this.getters.adjustViewportZone(this.viewport);
            // check for position changes
            if (this.checkChanges() && this.currentPositionInViewport) {
                this.currentPositionInViewport = false;
                this.viewport = this.getters.adjustViewportPosition(this.viewport);
                this.hScrollbar.scroll = this.viewport.offsetX;
                this.vScrollbar.scroll = this.viewport.offsetY;
            }
            this.snappedViewport = this.getters.snapViewportToCell(this.viewport);
            // drawing grid on canvas
            const canvas = this.canvas.el;
            const dpr = window.devicePixelRatio || 1;
            const ctx = canvas.getContext("2d", { alpha: false });
            const thinLineWidth = 0.4 * dpr;
            const renderingContext = { ctx, viewport: this.viewport, dpr, thinLineWidth };
            const { width, height } = this.viewport;
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            canvas.setAttribute("style", `width:${width}px;height:${height}px;`);
            ctx.translate(-0.5, -0.5);
            ctx.scale(dpr, dpr);
            this.props.model.drawGrid(renderingContext);
        }
        moveCanvas(deltaX, deltaY) {
            this.vScrollbar.scroll = this.vScrollbar.scroll + deltaY;
            this.hScrollbar.scroll = this.hScrollbar.scroll + deltaX;
        }
        onMouseWheel(ev) {
            function normalize(val) {
                return val * (ev.deltaMode === 0 ? 1 : DEFAULT_CELL_HEIGHT);
            }
            this.moveCanvas(normalize(ev.deltaX), normalize(ev.deltaY));
        }
        // ---------------------------------------------------------------------------
        // Zone selection with mouse
        // ---------------------------------------------------------------------------
        getCartesianCoordinates(ev) {
            const rect = this.el.getBoundingClientRect();
            const x = ev.pageX - rect.left;
            const y = ev.pageY - rect.top;
            const colIndex = this.getters.getColIndex(x, this.snappedViewport.left);
            const rowIndex = this.getters.getRowIndex(y, this.snappedViewport.top);
            return [colIndex, rowIndex];
        }
        onMouseDown(ev) {
            if (ev.button > 0) {
                // not main button, probably a context menu
                return;
            }
            const [col, row] = this.getCartesianCoordinates(ev);
            if (col < 0 || row < 0) {
                return;
            }
            this.clickedCol = col;
            this.clickedRow = row;
            this.dispatch(ev.ctrlKey ? "START_SELECTION_EXPANSION" : "START_SELECTION");
            if (ev.shiftKey) {
                this.dispatch("ALTER_SELECTION", { cell: [col, row] });
            }
            else {
                this.dispatch("SELECT_CELL", { col, row });
                this.checkChanges();
            }
            let prevCol = col;
            let prevRow = row;
            const onMouseMove = (ev) => {
                const [col, row] = this.getCartesianCoordinates(ev);
                if (col < 0 || row < 0) {
                    return;
                }
                if (col !== prevCol || row !== prevRow) {
                    prevCol = col;
                    prevRow = row;
                    this.dispatch("ALTER_SELECTION", { cell: [col, row] });
                }
            };
            const onMouseUp = (ev) => {
                this.dispatch(ev.ctrlKey ? "PREPARE_SELECTION_EXPANSION" : "STOP_SELECTION");
                if (this.getters.getEditionMode() === "selecting") {
                    if (this.composer.comp) {
                        this.composer.comp.addTextFromSelection();
                    }
                }
                this.canvas.el.removeEventListener("mousemove", onMouseMove);
                if (this.getters.isPaintingFormat()) {
                    this.dispatch("PASTE", {
                        target: this.getters.getSelectedZones(),
                    });
                }
            };
            startDnd(onMouseMove, onMouseUp);
        }
        onDoubleClick(ev) {
            const [col, row] = this.getCartesianCoordinates(ev);
            if (this.clickedCol === col && this.clickedRow === row) {
                this.dispatch("START_EDITION");
            }
        }
        // ---------------------------------------------------------------------------
        // Keyboard interactions
        // ---------------------------------------------------------------------------
        processTabKey(ev) {
            ev.preventDefault();
            const deltaX = ev.shiftKey ? -1 : 1;
            this.dispatch("MOVE_POSITION", { deltaX, deltaY: 0 });
        }
        processArrows(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            const deltaMap = {
                ArrowDown: [0, 1],
                ArrowLeft: [-1, 0],
                ArrowRight: [1, 0],
                ArrowUp: [0, -1],
            };
            this.currentPositionInViewport = true;
            const delta = deltaMap[ev.key];
            if (ev.shiftKey) {
                this.dispatch("ALTER_SELECTION", { delta });
            }
            else {
                this.dispatch("MOVE_POSITION", { deltaX: delta[0], deltaY: delta[1] });
            }
            if (this.getters.getEditionMode() === "selecting" && this.composer.comp) {
                this.composer.comp.addTextFromSelection();
            }
            else if (this.getters.isPaintingFormat()) {
                this.dispatch("PASTE", {
                    target: this.getters.getSelectedZones(),
                });
            }
        }
        onKeydown(ev) {
            if (ev.key.startsWith("Arrow")) {
                this.processArrows(ev);
                return;
            }
            let keyDownString = "";
            if (ev.ctrlKey)
                keyDownString += "CTRL+";
            if (ev.metaKey)
                keyDownString += "CTRL+";
            if (ev.altKey)
                keyDownString += "ALT+";
            if (ev.shiftKey)
                keyDownString += "SHIFT+";
            keyDownString += ev.key.toUpperCase();
            let handler = this.keyDownMapping[keyDownString];
            if (handler) {
                ev.preventDefault();
                ev.stopPropagation();
                handler();
                return;
            }
            if (!keyDownMappingIgnore.includes(keyDownString)) {
                if (ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
                    // if the user types a character on the grid, it means he wants to start composing the selected cell with that
                    // character
                    ev.preventDefault();
                    ev.stopPropagation();
                    this.dispatch("START_EDITION", { text: ev.key });
                }
            }
        }
        // ---------------------------------------------------------------------------
        // Context Menu
        // ---------------------------------------------------------------------------
        onCanvasContextMenu(ev) {
            ev.preventDefault();
            const [col, row] = this.getCartesianCoordinates(ev);
            if (col < 0 || row < 0) {
                return;
            }
            const zones = this.getters.getSelectedZones();
            const lastZone = zones[zones.length - 1];
            let type = "CELL";
            if (!isInside(col, row, lastZone)) {
                this.dispatch("SELECT_CELL", { col, row });
            }
            else {
                if (this.getters.getActiveCols().has(col)) {
                    type = "COL";
                }
                else if (this.getters.getActiveRows().has(row)) {
                    type = "ROW";
                }
            }
            this.toggleContextMenu(type, ev.offsetX, ev.offsetY);
        }
        onOverlayContextMenu(ev) {
            const type = ev.detail.type;
            const x = ev.detail.x;
            const y = ev.detail.y;
            this.toggleContextMenu(type, x, y);
        }
        toggleContextMenu(type, x, y) {
            this.menuState.isOpen = true;
            this.menuState.position = {
                x,
                y,
                width: this.el.clientWidth,
                height: this.el.clientHeight,
            };
            this.menuState.menuItems = registries$1[type]
                .getAll()
                .filter((item) => !item.isVisible || item.isVisible(this.env));
        }
    }
    Grid.template = TEMPLATE$2;
    Grid.style = CSS$2;
    Grid.components = { Composer, Overlay, Menu, Autofill, FiguresContainer };

    const Component$2 = owl__namespace.Component;
    const { xml: xml$2, css: css$2 } = owl__namespace.tags;
    const { useState: useState$2 } = owl__namespace.hooks;
    const TEMPLATE$1 = xml$2 /* xml */ `
  <div class="o-sidePanel" >
    <div class="o-sidePanelHeader">
        <div class="o-sidePanelTitle" t-esc="getTitle()"/>
        <div class="o-sidePanelClose" t-on-click="trigger('close-side-panel')">×</div>
    </div>
    <div class="o-sidePanelBody">
      <t t-component="state.panel.Body" t-props="props.panelProps" t-key="'Body_' + props.component"/>
    </div>
    <div class="o-sidePanelFooter" t-if="state.panel.Footer">
      <t t-component="state.panel.Footer" t-props="props.panelProps" t-key="'Footer_' + props.component"/>
    </div>
  </div>`;
    const CSS$1 = css$2 /* scss */ `
  .o-sidePanel {
    display: flex;
    flex-direction: column;
    overflow-x: hidden;
    background-color: white;
    border: 1px solid darkgray;
    .o-sidePanelHeader {
      padding: 6px;
      height: 30px;
      background-color: #f8f9fa;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid darkgray;
      font-weight: bold;
      .o-sidePanelTitle {
        font-weight: bold;
        padding: 5px 10px;
        font-size: 1.2rem;
      }
      .o-sidePanelClose {
        font-size: 1.5rem;
        padding: 5px 10px;
        cursor: pointer;
        &:hover {
          background-color: WhiteSmoke;
        }
      }
    }
    .o-sidePanelBody {
      overflow: auto;
      width: 100%;
      height: 100%;
    }

    .o-sidePanelButtons {
      padding: 5px 16px;
      text-align: right;
      .o-sidePanelButton {
        border: 1px solid lightgrey;
        padding: 0px 20px 0px 20px;
        border-radius: 4px;
        font-weight: 500;
        font-size: 14px;
        height: 30px;
        line-height: 16px;
        background: white;
        cursor: pointer;
        margin-right: 8px;
        &:hover {
          background-color: rgba(0, 0, 0, 0.08);
        }
      }
      .o-sidePanelButton:last-child {
        margin-right: 0px;
      }
    }
    .o-input {
      border-radius: 4px;
      border: 1px solid lightgrey;
      padding: 4px 6px;
      width: 96%;
      .o-type-selector {
        background-position: right 5px top 11px;
      }
    }
    select.o-input {
      background-color: white;
      text-align: left;
    }

    .o-section {
      padding: 16px;
      .o-section-title {
        font-weight: bold;
        margin-bottom: 5px;
      }
    }
  }
`;
    class SidePanel extends Component$2 {
        constructor() {
            super(...arguments);
            this.state = useState$2({
                panel: sidePanelRegistry.get(this.props.component),
            });
        }
        async willUpdateProps(nextProps) {
            this.state.panel = sidePanelRegistry.get(nextProps.component);
        }
        getTitle() {
            return typeof this.state.panel.title === "function"
                ? this.state.panel.title(this.env)
                : this.state.panel.title;
        }
    }
    SidePanel.template = TEMPLATE$1;
    SidePanel.style = CSS$1;

    const { useState: useState$1, hooks } = owl__namespace;
    const Component$1 = owl__namespace.Component;
    const { xml: xml$1, css: css$1 } = owl__namespace.tags;
    const { useExternalListener: useExternalListener$1, useRef: useRef$1 } = hooks;
    const FORMATS = [
        { name: "auto", text: "Automatic" },
        { name: "number", text: "Number (1,000.12)", value: "#,##0.00" },
        { name: "percent", text: "Percent (10.12%)", value: "0.00%" },
        { name: "date", text: "Date (9/26/2008)", value: "m/d/yyyy" },
        { name: "time", text: "Time (10:43:00 PM)", value: "hh:mm:ss a" },
        { name: "datetime", text: "Date time (9/26/2008 22:43:00)", value: "m/d/yyyy hh:mm:ss" },
        { name: "duration", text: "Duration (27:51:38)", value: "hhhh:mm:ss" },
    ];
    // -----------------------------------------------------------------------------
    // TopBar
    // -----------------------------------------------------------------------------
    class TopBar extends Component$1 {
        constructor() {
            super(...arguments);
            this.formats = FORMATS;
            this.currentFormat = "auto";
            this.fontSizes = fontSizes;
            this.dispatch = this.env.dispatch;
            this.getters = this.env.getters;
            this.style = {};
            this.state = useState$1({
                menuState: { isOpen: false, position: null, menuItems: [] },
                activeTool: "",
            });
            this.isSelectingMenu = false;
            this.openedEl = null;
            this.inMerge = false;
            this.cannotMerge = false;
            this.undoTool = false;
            this.redoTool = false;
            this.paintFormatTool = false;
            this.fillColor = "white";
            this.textColor = "black";
            this.menus = [];
            this.menuRef = useRef$1("menuRef");
            useExternalListener$1(window, "click", this.onClick);
        }
        get topbarComponents() {
            return topbarComponentRegistry
                .getAll()
                .filter((item) => !item.isVisible || item.isVisible(this.env));
        }
        async willStart() {
            this.updateCellState();
        }
        async willUpdateProps() {
            this.updateCellState();
        }
        onClick(ev) {
            if (this.openedEl && isChildEvent(this.openedEl, ev)) {
                return;
            }
            this.closeMenus();
        }
        toogleStyle(style) {
            setStyle(this.env, { [style]: !this.style[style] });
        }
        toogleFormat(format) {
            const formatter = FORMATS.find((f) => f.name === format);
            const value = (formatter && formatter.value) || "";
            setFormatter(this.env, value);
        }
        toggleAlign(align) {
            setStyle(this.env, { ["align"]: align });
        }
        onMenuMouseOver(menu, ev) {
            if (this.isSelectingMenu) {
                this.toggleContextMenu(menu, ev);
            }
        }
        toggleDropdownTool(tool, ev) {
            const isOpen = this.state.activeTool === tool;
            this.closeMenus();
            this.state.activeTool = isOpen ? "" : tool;
            this.openedEl = isOpen ? null : ev.target;
        }
        toggleContextMenu(menu, ev) {
            this.closeMenus();
            const x = ev.target.offsetLeft;
            const y = ev.target.clientHeight + ev.target.offsetTop;
            this.state.menuState.isOpen = true;
            const width = this.el.clientWidth;
            const height = this.el.parentElement.clientHeight;
            this.state.menuState.position = { x, y, width, height };
            this.state.menuState.menuItems = topbarMenuRegistry
                .getChildren(menu, this.env)
                .filter((item) => !item.isVisible || item.isVisible(this.env));
            this.isSelectingMenu = true;
            this.openedEl = ev.target;
        }
        closeMenus() {
            this.state.activeTool = "";
            this.state.menuState.isOpen = false;
            this.isSelectingMenu = false;
            this.openedEl = null;
            if (this.menuRef.comp) {
                this.menuRef.comp.closeSubMenus();
            }
        }
        updateCellState() {
            this.style = this.getters.getCurrentStyle();
            this.fillColor = this.style.fillColor || "white";
            this.textColor = this.style.textColor || "black";
            const zones = this.getters.getSelectedZones();
            const { top, left, right, bottom } = zones[0];
            this.cannotMerge = zones.length > 1 || (top === bottom && left === right);
            this.inMerge = false;
            if (!this.cannotMerge) {
                const [col, row] = this.getters.getPosition();
                const zone = this.getters.expandZone({ left: col, right: col, top: row, bottom: row });
                this.inMerge = isEqual(zones[0], zone);
            }
            this.undoTool = this.getters.canUndo();
            this.redoTool = this.getters.canRedo();
            this.paintFormatTool = this.getters.isPaintingFormat();
            const cell = this.getters.getActiveCell();
            if (cell && cell.format) {
                const format = this.formats.find((f) => f.value === cell.format);
                this.currentFormat = format ? format.name : "";
            }
            else {
                this.currentFormat = "auto";
            }
            this.menus = topbarMenuRegistry
                .getAll()
                .filter((item) => !item.isVisible || item.isVisible(this.env));
        }
        getMenuName(menu) {
            return topbarMenuRegistry.getName(menu, this.env);
        }
        toggleMerge() {
            const zones = this.getters.getSelectedZones();
            const zone = zones[zones.length - 1];
            const sheet = this.getters.getActiveSheet();
            if (this.inMerge) {
                this.dispatch("REMOVE_MERGE", { sheet, zone });
            }
            else {
                this.dispatch("ADD_MERGE", { sheet, zone, interactive: true });
            }
        }
        setColor(target, ev) {
            setStyle(this.env, { [target]: ev.detail.color });
        }
        setBorder(command) {
            this.dispatch("SET_FORMATTING", {
                sheet: this.getters.getActiveSheet(),
                target: this.getters.getSelectedZones(),
                border: command,
            });
        }
        setFormat(ev) {
            const format = ev.target.dataset.format;
            if (format) {
                this.toogleFormat(format);
            }
        }
        setDecimal(step) {
            this.dispatch("SET_DECIMAL", {
                sheet: this.getters.getActiveSheet(),
                target: this.getters.getSelectedZones(),
                step: step,
            });
        }
        paintFormat() {
            this.dispatch("ACTIVATE_PAINT_FORMAT", {
                target: this.getters.getSelectedZones(),
            });
        }
        clearFormatting() {
            this.dispatch("CLEAR_FORMATTING", {
                sheet: this.getters.getActiveSheet(),
                target: this.getters.getSelectedZones(),
            });
        }
        setSize(ev) {
            const fontSize = parseFloat(ev.target.dataset.size);
            setStyle(this.env, { fontSize });
        }
        doAction(action) {
            action(this.env);
            this.closeMenus();
        }
        undo() {
            this.dispatch("UNDO");
        }
        redo() {
            this.dispatch("REDO");
        }
    }
    TopBar.template = xml$1 /* xml */ `
    <div class="o-spreadsheet-topbar">
      <div class="o-topbar-top">
        <!-- Menus -->
        <div class="o-topbar-topleft">
          <t t-foreach="menus" t-as="menu" t-key="menu_index">
            <div t-if="menu.children.length !== 0"
              class="o-topbar-menu"
              t-on-click="toggleContextMenu(menu)"
              t-on-mouseover="onMenuMouseOver(menu)"
              t-att-data-id="menu.id">
            <t t-esc="getMenuName(menu)"/>
          </div>
          </t>
          <Menu t-if="state.menuState.isOpen"
                position="state.menuState.position"
                menuItems="state.menuState.menuItems"
                t-ref="menuRef"
                t-on-close="state.menuState.isOpen=false"/>
        </div>
        <div class="o-topbar-topright">
          <div t-foreach="topbarComponents" t-as="comp" t-key="comp_index">
            <t t-component="comp.component"/>
          </div>
        </div>
      </div>
      <!-- Toolbar and Cell Content -->
      <div class="o-topbar-toolbar">
        <!-- Toolbar -->
        <div class="o-toolbar-tools">
          <div class="o-tool" title="Undo" t-att-class="{'o-disabled': !undoTool}" t-on-click="undo" >${UNDO_ICON}</div>
          <div class="o-tool" t-att-class="{'o-disabled': !redoTool}" title="Redo"  t-on-click="redo">${REDO_ICON}</div>
          <div class="o-tool" title="Paint Format" t-att-class="{active:paintFormatTool}" t-on-click="paintFormat">${PAINT_FORMAT_ICON}</div>
          <div class="o-tool" title="Clear Format" t-on-click="clearFormatting()">${CLEAR_FORMAT_ICON}</div>
          <div class="o-divider"/>
          <div class="o-tool" title="Format as percent" t-on-click="toogleFormat('percent')">%</div>
          <div class="o-tool" title="Decrease decimal places" t-on-click="setDecimal(-1)">.0</div>
          <div class="o-tool" title="Increase decimal places" t-on-click="setDecimal(+1)">.00</div>
          <div class="o-tool o-dropdown" title="More formats" t-on-click="toggleDropdownTool('formatTool')">
            <div class="o-text-icon">123${TRIANGLE_DOWN_ICON}</div>
            <div class="o-dropdown-content o-text-options  o-format-tool "  t-if="state.activeTool === 'formatTool'" t-on-click="setFormat">
              <t t-foreach="formats" t-as="format" t-key="format.name">
                <div t-att-data-format="format.name" t-att-class="{active: currentFormat === format.name}"><t t-esc="format.text"/></div>
              </t>
            </div>
          </div>
          <div class="o-divider"/>
          <!-- <div class="o-tool" title="Font"><span>Roboto</span> ${TRIANGLE_DOWN_ICON}</div> -->
          <div class="o-tool o-dropdown" title="Font Size" t-on-click="toggleDropdownTool('fontSizeTool')">
            <div class="o-text-icon"><t t-esc="style.fontSize || ${DEFAULT_FONT_SIZE}"/> ${TRIANGLE_DOWN_ICON}</div>
            <div class="o-dropdown-content o-text-options "  t-if="state.activeTool === 'fontSizeTool'" t-on-click="setSize">
              <t t-foreach="fontSizes" t-as="font" t-key="font_index">
                <div t-esc="font.pt" t-att-data-size="font.pt"/>
              </t>
            </div>
          </div>
          <div class="o-divider"/>
          <div class="o-tool" title="Bold" t-att-class="{active:style.bold}" t-on-click="toogleStyle('bold')">${BOLD_ICON}</div>
          <div class="o-tool" title="Italic" t-att-class="{active:style.italic}" t-on-click="toogleStyle('italic')">${ITALIC_ICON}</div>
          <div class="o-tool" title="Strikethrough"  t-att-class="{active:style.strikethrough}" t-on-click="toogleStyle('strikethrough')">${STRIKE_ICON}</div>
          <div class="o-tool o-dropdown o-with-color">
            <span t-attf-style="border-color:{{textColor}}" title="Text Color" t-on-click="toggleDropdownTool('textColorTool')">${TEXT_COLOR_ICON}</span>
            <ColorPicker t-if="state.activeTool === 'textColorTool'" t-on-color-picked="setColor('textColor')" t-key="textColor"/>
          </div>
          <div class="o-divider"/>
          <div class="o-tool  o-dropdown o-with-color">
            <span t-attf-style="border-color:{{fillColor}}" title="Fill Color" t-on-click="toggleDropdownTool('fillColorTool')">${FILL_COLOR_ICON}</span>
            <ColorPicker t-if="state.activeTool === 'fillColorTool'" t-on-color-picked="setColor('fillColor')" t-key="fillColor"/>
          </div>
          <div class="o-tool o-dropdown">
            <span title="Borders" t-on-click="toggleDropdownTool('borderTool')">${BORDERS_ICON}</span>
            <div class="o-dropdown-content o-border" t-if="state.activeTool === 'borderTool'">
              <div class="o-dropdown-line">
                <span class="o-line-item" t-on-click="setBorder('all')">${BORDERS_ICON}</span>
                <span class="o-line-item" t-on-click="setBorder('hv')">${BORDER_HV}</span>
                <span class="o-line-item" t-on-click="setBorder('h')">${BORDER_H}</span>
                <span class="o-line-item" t-on-click="setBorder('v')">${BORDER_V}</span>
                <span class="o-line-item" t-on-click="setBorder('external')">${BORDER_EXTERNAL}</span>
              </div>
              <div class="o-dropdown-line">
                <span class="o-line-item" t-on-click="setBorder('left')">${BORDER_LEFT}</span>
                <span class="o-line-item" t-on-click="setBorder('top')">${BORDER_TOP}</span>
                <span class="o-line-item" t-on-click="setBorder('right')">${BORDER_RIGHT}</span>
                <span class="o-line-item" t-on-click="setBorder('bottom')">${BORDER_BOTTOM}</span>
                <span class="o-line-item" t-on-click="setBorder('clear')">${BORDER_CLEAR}</span>
              </div>
            </div>
          </div>
          <div class="o-tool" title="Merge Cells"  t-att-class="{active:inMerge, 'o-disabled': cannotMerge}" t-on-click="toggleMerge">${MERGE_CELL_ICON}</div>
          <div class="o-divider"/>
          <div class="o-tool o-dropdown" title="Horizontal align" t-on-click="toggleDropdownTool('alignTool')">
            <span>
              <t t-if="style.align === 'right'">${ALIGN_RIGHT_ICON}</t>
              <t t-elif="style.align === 'center'">${ALIGN_CENTER_ICON}</t>
              <t t-else="">${ALIGN_LEFT_ICON}</t>
              ${TRIANGLE_DOWN_ICON}
            </span>
            <div t-if="state.activeTool === 'alignTool'" class="o-dropdown-content">
              <div class="o-dropdown-item" t-on-click="toggleAlign('left')">${ALIGN_LEFT_ICON}</div>
              <div class="o-dropdown-item" t-on-click="toggleAlign('center')">${ALIGN_CENTER_ICON}</div>
              <div class="o-dropdown-item" t-on-click="toggleAlign('right')">${ALIGN_RIGHT_ICON}</div>
            </div>
          </div>
          <!-- <div class="o-tool" title="Vertical align"><span>${ALIGN_MIDDLE_ICON}</span> ${TRIANGLE_DOWN_ICON}</div> -->
          <!-- <div class="o-tool" title="Text Wrapping">${TEXT_WRAPPING_ICON}</div> -->
          <div class="o-divider"/>
        </div>

        <!-- Cell content -->
        <div class="o-toolbar-cell-content">
          <t t-set="cell" t-value="getters.getActiveCell()"/>
          <t t-esc="cell and cell.content"/>
        </div>

      </div>
    </div>`;
    TopBar.style = css$1 /* scss */ `
    .o-spreadsheet-topbar {
      background-color: white;
      display: flex;
      flex-direction: column;
      font-size: 13px;
      user-select: none;
      .o-topbar-top {
        border-bottom: 1px solid #e0e2e4;
        display: flex;
        padding: 2px 10px;
        justify-content: space-between;

        /* Menus */
        .o-topbar-topleft {
          display: flex;
          .o-topbar-menu {
            padding: 4px 6px;
            margin: 0 2px;
            cursor: pointer;
          }

          .o-topbar-menu:hover {
            background-color: #f1f3f4;
            border-radius: 2px;
          }
        }

        .o-topbar-topright {
          display: flex;
          justify-content: flex-end;
        }
      }
      /* Toolbar + Cell Content */
      .o-topbar-toolbar {
        border-bottom: 1px solid #e0e2e4;
        display: flex;

        /* Toolbar */
        .o-toolbar-tools {
          display: flex;
          flex-shrink: 0;
          margin-left: 20px;
          color: #333;
          cursor: default;

          .o-tool {
            display: flex;
            align-items: center;
            margin: 2px;
            padding: 0 3px;
            border-radius: 2px;
            cursor: pointer;
            min-width: fit-content;
          }

          .o-tool.active,
          .o-tool:not(.o-disabled):hover {
            background-color: #f1f3f4;
          }

          .o-with-color > span {
            border-bottom: 4px solid;
            height: 16px;
            margin-top: 2px;
          }

          .o-with-color {
            .o-line-item:hover {
              outline: 1px solid gray;
            }
          }

          .o-border {
            .o-line-item {
              padding: 4px;
              margin: 1px;
            }
          }

          .o-divider {
            display: inline-block;
            border-right: 1px solid #e0e2e4;
            width: 0;
            margin: 0 6px;
          }

          .o-disabled {
            opacity: 0.6;
          }

          .o-dropdown {
            position: relative;

            .o-text-icon {
              height: 100%;
              line-height: 30px;
              > svg {
                margin-bottom: -5px;
              }
            }

            .o-text-options > div {
              line-height: 26px;
              padding: 3px 12px;
              &:hover {
                background-color: rgba(0, 0, 0, 0.08);
              }
            }

            .o-dropdown-content {
              position: absolute;
              top: calc(100% + 5px);
              left: 0;
              z-index: 10;
              box-shadow: 1px 2px 5px 2px rgba(51, 51, 51, 0.15);
              background-color: white;

              .o-dropdown-item {
                padding: 7px 10px;
              }

              .o-dropdown-item:hover {
                background-color: rgba(0, 0, 0, 0.08);
              }

              .o-dropdown-line {
                display: flex;
                padding: 3px 6px;

                .o-line-item {
                  width: 16px;
                  height: 16px;
                  margin: 1px 3px;

                  &:hover {
                    background-color: rgba(0, 0, 0, 0.08);
                  }
                }
              }

              &.o-format-tool {
                width: 180px;
                padding: 7px 0;
                > div {
                  padding-left: 25px;

                  &.active:before {
                    content: "✓";
                    font-weight: bold;
                    position: absolute;
                    left: 10px;
                  }
                }
              }
            }
          }
        }

        /* Cell Content */
        .o-toolbar-cell-content {
          font-size: 12px;
          font-weight: 500;
          padding: 0 12px;
          margin: 0;
          line-height: 34px;
          white-space: nowrap;
          user-select: text;
        }
      }
    }
  `;
    TopBar.components = { ColorPicker, Menu };

    const { useState } = owl__namespace;
    const Component = owl__namespace.Component;
    const { useRef, useExternalListener } = owl__namespace.hooks;
    const { xml, css } = owl__namespace.tags;
    const { useSubEnv } = owl__namespace.hooks;
    // -----------------------------------------------------------------------------
    // SpreadSheet
    // -----------------------------------------------------------------------------
    const TEMPLATE = xml /* xml */ `
  <div class="o-spreadsheet" t-on-save-requested="save" t-on-keydown="onKeydown">
    <TopBar t-on-click="focusGrid" class="o-two-columns"/>
    <Grid model="model" t-ref="grid" t-att-class="{'o-two-columns': !sidePanel.isOpen}"/>
    <SidePanel t-if="sidePanel.isOpen"
           t-on-close-side-panel="sidePanel.isOpen = false"
           component="sidePanel.component"
           panelProps="sidePanel.panelProps"/>
    <BottomBar t-on-click="focusGrid" class="o-two-columns"/>
  </div>`;
    const CSS = css /* scss */ `
  .o-spreadsheet {
    display: grid;
    grid-template-rows: ${TOPBAR_HEIGHT}px auto ${BOTTOMBAR_HEIGHT + 1}px;
    grid-template-columns: auto 350px;
    * {
      font-family: "Roboto", "RobotoDraft", Helvetica, Arial, sans-serif;
    }
    &,
    *,
    *:before,
    *:after {
      box-sizing: content-box;
    }
  }

  .o-two-columns {
    grid-column: 1 / 3;
  }

  .o-icon {
    width: 18px;
    height: 18px;
    opacity: 0.6;
  }
`;
    const t = (s) => s;
    class Spreadsheet extends Component {
        constructor() {
            super(...arguments);
            this.model = new Model(this.props.data, {
                notifyUser: (content) => this.trigger("notify-user", { content }),
                askConfirmation: (content, confirm, cancel) => this.trigger("ask-confirmation", { content, confirm, cancel }),
                editText: (title, placeholder, callback) => this.trigger("edit-text", { title, placeholder, callback }),
                openSidePanel: (panel, panelProps = {}) => this.openSidePanel(panel, panelProps),
                evalContext: { env: this.env },
            });
            this.grid = useRef("grid");
            this.sidePanel = useState({ isOpen: false, panelProps: {} });
            // last string that was cut or copied. It is necessary so we can make the
            // difference between a paste coming from the sheet itself, or from the
            // os clipboard
            this.clipBoardString = "";
            useSubEnv({
                openSidePanel: (panel, panelProps = {}) => this.openSidePanel(panel, panelProps),
                toggleSidePanel: (panel, panelProps = {}) => this.toggleSidePanel(panel, panelProps),
                dispatch: this.model.dispatch,
                getters: this.model.getters,
                _t: Spreadsheet._t,
                clipboard: navigator.clipboard,
                export: this.model.exportData.bind(this.model),
            });
            useExternalListener(window, "resize", this.render);
            useExternalListener(document.body, "cut", this.copy.bind(this, true));
            useExternalListener(document.body, "copy", this.copy.bind(this, false));
            useExternalListener(document.body, "paste", this.paste);
            useExternalListener(document.body, "keyup", this.onKeyup.bind(this));
        }
        mounted() {
            this.model.on("update", this, this.render);
        }
        willUnmount() {
            this.model.off("update", this);
        }
        destroy() {
            this.model.destroy();
            super.destroy();
        }
        openSidePanel(panel, panelProps) {
            this.sidePanel.component = panel;
            this.sidePanel.panelProps = panelProps;
            this.sidePanel.isOpen = true;
        }
        toggleSidePanel(panel, panelProps) {
            if (this.sidePanel.isOpen && panel === this.sidePanel.component) {
                this.sidePanel.isOpen = false;
            }
            else {
                this.openSidePanel(panel, panelProps);
            }
        }
        focusGrid() {
            this.grid.comp.focus();
        }
        copy(cut, ev) {
            if (!this.grid.el.contains(document.activeElement)) {
                return;
            }
            /* If we are currently editing a cell, let the default behavior */
            if (this.model.getters.getEditionMode() !== "inactive") {
                return;
            }
            const type = cut ? "CUT" : "COPY";
            const target = this.model.getters.getSelectedZones();
            this.model.dispatch(type, { target });
            const content = this.model.getters.getClipboardContent();
            this.clipBoardString = content;
            ev.clipboardData.setData("text/plain", content);
            ev.preventDefault();
        }
        paste(ev) {
            if (!this.grid.el.contains(document.activeElement)) {
                return;
            }
            const clipboardData = ev.clipboardData;
            if (clipboardData.types.indexOf("text/plain") > -1) {
                const content = clipboardData.getData("text/plain");
                const target = this.model.getters.getSelectedZones();
                if (this.clipBoardString === content) {
                    // the paste actually comes from o-spreadsheet itself
                    this.model.dispatch("PASTE", { target, interactive: true });
                }
                else {
                    this.model.dispatch("PASTE_FROM_OS_CLIPBOARD", {
                        target,
                        text: content,
                    });
                }
            }
        }
        save() {
            this.trigger("save-content", {
                data: this.model.exportData(),
            });
        }
        onKeyup(ev) {
            if (ev.key === "Control" && this.model.getters.getSelectionMode() !== SelectionMode.expanding) {
                this.model.dispatch("STOP_SELECTION");
            }
        }
        onKeydown(ev) {
            if (ev.key === "Control" && !ev.repeat) {
                this.model.dispatch(this.model.getters.getSelectionMode() === SelectionMode.idle
                    ? "PREPARE_SELECTION_EXPANSION"
                    : "START_SELECTION_EXPANSION");
            }
        }
    }
    Spreadsheet.template = TEMPLATE;
    Spreadsheet.style = CSS;
    Spreadsheet.components = { TopBar, Grid, BottomBar, SidePanel };
    Spreadsheet._t = t;

    /**
     * We export here all entities that needs to be accessed publicly by Odoo.
     *
     * Note that the __info__ key is actually completed by the build process (see
     * the rollup.config.js file)
     */
    const __info__ = {};
    const SPREADSHEET_DIMENSIONS = {
        MIN_ROW_HEIGHT,
        MIN_COL_WIDTH,
        HEADER_HEIGHT,
        HEADER_WIDTH,
        TOPBAR_HEIGHT,
        BOTTOMBAR_HEIGHT,
        DEFAULT_CELL_WIDTH,
        DEFAULT_CELL_HEIGHT,
        SCROLLBAR_WIDTH,
    };
    const registries = {
        autofillModifiersRegistry,
        autofillRulesRegistry,
        cellMenuRegistry,
        colMenuRegistry,
        functionRegistry,
        pluginRegistry,
        rowMenuRegistry,
        sidePanelRegistry,
        sheetMenuRegistry,
        topbarMenuRegistry,
        topbarComponentRegistry,
    };
    const helpers = {
        args,
        toBoolean,
        toNumber,
        toString,
        toXC,
        toZone,
        toCartesian,
        numberToLetters,
        createFullMenuItem,
        uuidv4,
        formatDecimal,
    };

    exports.BasePlugin = BasePlugin;
    exports.Model = Model;
    exports.SPREADSHEET_DIMENSIONS = SPREADSHEET_DIMENSIONS;
    exports.Spreadsheet = Spreadsheet;
    exports.__DEBUG__ = DEBUG;
    exports.__info__ = __info__;
    exports.astToFormula = astToFormula;
    exports.functionCache = functionCache;
    exports.helpers = helpers;
    exports.normalize = normalize;
    exports.parse = parse;
    exports.registries = registries;
    exports.setTranslationMethod = setTranslationMethod;

    Object.defineProperty(exports, '__esModule', { value: true });


    __info__.version = '14.0.3';
    __info__.date = '2023-04-21T07:54:12.446Z';
    __info__.hash = '32b98aa';


})(this.o_spreadsheet = this.o_spreadsheet || {}, owl);
//# sourceMappingURL=o_spreadsheet.js.map
