#!/usr/bin/env node
// Stop-Hook: Erinnert daran, die Doku zu pruefen, wenn auf dem aktuellen Branch
// Code unter private/ oder public/ geaendert wurde, aber doc/ nicht.
//
// Sicherungen:
//  - Meldet sich nur, wenn src-Aenderungen ohne begleitende doc-Aenderung vorliegen.
//  - Maximal EINMAL pro Sitzung (Marker-Datei), damit decision:"block" keine
//    Stop-Schleife ausloest.
//
// Ausgabe bei Treffer: JSON mit decision:"block" + reason -> wird mir (dem Modell)
// als Hinweis zurueckgespielt; ich entscheide dann, ob die Doku angepasst wird.

const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

let input = {};
try {
  input = JSON.parse(readStdin() || '{}');
} catch {
  input = {};
}

const sessionId = input.session_id || 'nosession';
const proj = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const marker = path.join(os.tmpdir(), `claude-docsync-${sessionId}`);

// Schon in dieser Sitzung erinnert -> sauber beenden (verhindert Schleifen).
if (fs.existsSync(marker)) {
  process.exit(0);
}

function git(args) {
  try {
    return execSync(`git ${args}`, {
      cwd: proj,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

// Aenderungen auf dem Branch (gegen main) UND im Arbeitsbaum einsammeln.
const base = git('merge-base HEAD main');
let src = '';
let doc = '';
if (base) {
  src += git(`diff --name-only ${base}...HEAD -- private public`);
  doc += git(`diff --name-only ${base}...HEAD -- doc`);
}
src += '\n' + git('status --porcelain -- private public');
doc += '\n' + git('status --porcelain -- doc');

const srcChanged = src.trim().length > 0;
const docChanged = doc.trim().length > 0;

if (srcChanged && !docChanged) {
  fs.writeFileSync(marker, '');
  process.stdout.write(
    JSON.stringify({
      decision: 'block',
      reason:
        'Doc-Sync-Check: Auf diesem Branch wurde Code unter private/ oder public/ ' +
        'geaendert, aber doc/ nicht. Pruefe, ob doc/architecture.md (Request-Flow, ' +
        'Datenmodell, Schichten) oder doc/conventions.md (Frontend-Muster) ' +
        'aktualisiert werden muessen. Falls ja: als eigenen EPC-Teilschritt mit ' +
        'eigenem Commit umsetzen. Falls die Doku bereits stimmt: kurz bestaetigen ' +
        'und beenden.',
    })
  );
}

process.exit(0);
