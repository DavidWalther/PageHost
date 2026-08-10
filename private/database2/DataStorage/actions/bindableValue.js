/**
 * Was als gebundener Wert in eine Anfrage darf.
 *
 * Neben den Skalaren sind **einfache Objekte und Arrays** erlaubt — sie gehören
 * in `json`/`jsonb`-Spalten. Serialisiert werden sie vom Treiber: Der lässt
 * sich den aufgelösten Parametertyp vom Server beschreiben und wendet für
 * `json`/`jsonb` `JSON.stringify` an.
 *
 * **Deshalb darf der Aufrufer nicht vorcodieren.** Wer einen fertigen
 * JSON-Text übergibt, lässt ihn ein zweites Mal codieren; in der Spalte steht
 * dann ein JSON-**String** statt eines Objekts, und `->>` findet darin kein
 * Feld mehr. Genau so brach der Refresh-Token.
 *
 * `Date`, `Map` und Klassen-Instanzen bleiben draußen: Ihre Form in einer
 * JSON-Spalte hat hier niemand festgelegt.
 */
class BindableValue {
  static isBindable(value) {
    if (value === null) {
      return true;
    }
    const type = typeof value;
    if (type === 'string' || type === 'number' || type === 'boolean') {
      return true;
    }
    if (type !== 'object') {
      return false;
    }
    if (Array.isArray(value)) {
      return true;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }
}

module.exports = { BindableValue };
