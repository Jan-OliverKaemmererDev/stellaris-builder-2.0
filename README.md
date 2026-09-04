<div align="center">

  <img src="public/assets/logo.png" alt="Stellaris Builder 2.0 Logo" width="380" />

  # STELLARIS BUILDER 2.0
  ### *Ein interstellares Sci-Fi-Aufbau- und Strategiespiel im Browser*

  [![Angular](https://img.shields.io/badge/Angular-21.2-DD0031?style=for-the-badge&logo=angular&logoColor=white)](https://angular.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Three.js](https://img.shields.io/badge/Three.js-0.185-000000?style=for-the-badge&logo=threedotjs&logoColor=white)](https://threejs.org/)
  [![Firebase](https://img.shields.io/badge/Firebase-12.14-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
  [![Vitest](https://img.shields.io/badge/Tested%20with-Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev/)
  [![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](#lizenz)

  <p align="center">
    <b>Übernimm das Kommando über ein aufstrebendes Sternenreich.</b><br>
    Fördere Ressourcen, meistere komplexe Energiehaushalte mit intelligentem Lastabwurf,<br>
    erforsche futuristische Technologien, baue schlagkräftige Raumflotten auf,<br>
    erlebe atmosphärischen Sound mit Sprachausgabe und verteidige dein Territorium gegen unberechenbare Raids.
  </p>

  [Funktionen](#-features--spielmechaniken) • [Technologie-Stack](#-technologie-stack) • [Installation & Setup](#-schnellstart--installation) • [Architektur](#-architektur--projektstruktur) • [Spielregeln](#-spielregeln--tipps-für-den-einstieg)

</div>

---

## 🌌 Über das Projekt

**Stellaris Builder 2.0** ist ein immersives, browserbasiertes Sci-Fi-Aufbau- und Managementspiel. Es kombiniert klassische Idle-/Incremental-Mechaniken mit anspruchsvollem Ressourcenmanagement, Echtzeit-Flottenoperationen, Lastabwurf-Energiemanagement und einem dynamischen Kampfsystem.

Das Projekt wurde mit modernstem **Angular 21** (Standalone Components, Signals & Modern Control Flow) umgesetzt und setzt auf visuell beeindruckende **Three.js WebGL-Shader** (inkl. interaktivem 3D-Schwarzen-Loch mit Gravitationslinse und Bloom-Effekt), responsive Sci-Fi-HUD-Grafiken, ein vollwertiges **Audio-System** mit Soundtrack und KI-Sprachausgabe sowie Cloud-Synchronisation über **Firebase**.

---

## ✨ Features & Spielmechaniken

### ⛏️ Ressourcen & Wirtschaft
* **Primärressourcen:** Kontinuierlicher Abbau von **Eisen**, **Silber** und **Gold** über aufrüstbare Minenanlagen.
* **Spezial- & Sekundärgüter:**
  * **Xenonit:** Seltenes Element, gewonnen durch planetare Raffinerien für Highend-Technologien und schwere Kriegsschiffe.
  * **Personal & Bevölkerung:** Generiert durch orbitale Raumstationen und Kolonisierungsschiffe.
  * **Nahrung:** Versorgungsbasis durch Biolabore und Transportschiffe.
  * **Credits:** Galaktische Währung durch Handelsstationen, interstellare Märkte und Börsen.

### ⚡ Komplexes Energie- & Lastabwurf-System
* **Energieerzeugung:** Solarkraftwerke, Fusionsreaktoren und Antimaterie-Reaktoren mit exponentieller Skalierung.
* **Permanenter Upkeep:** Jedes Gebäude und jedes Raumschiff verbraucht kontinuierlich Energie.
* **🔌 Notfall-Abschaltung / Lastabwurf (Power-Toggle):**
  * Gebäude und Flotteneinheiten können per Klick auf das **Blitz-Icon** abgeschaltet werden.
  * Deaktivierte Einheiten verbrauchen **0 Energie** (mit markantem `OFFLINE`-Indikator), wodurch das Stromnetz bei Engpässen sofort entlastet wird.
* **📊 Dynamische HUD-Energieanzeige:** Vertikaler Energiebalken mit Echtzeit-Prozentwerten und dynamischem Farbwechsel (Grün / Gelb / Rot).
* **⚠️ Blackout-Mechanik:** Fällt die verfügbare Energie auf oder unter 0, **stoppt die Minenproduktion vollständig**, bis wieder ein positiver Energiehaushalt hergestellt ist.

### 🎵 Integriertes Audio- & Sound-System
* **Atmosphärischer Soundtrack:** Sci-Fi Ambient-Musikstücke (*Paradigm*, *Chronometry*) mit integriertem Player (Play/Pause, Track-Wechsel, Fortschrittsanzeige).
* **Dynamische Soundeffekte (SFX):** Akustisches Feedback bei Schiffsbau, Missionsstarts, Klicks und Upgrades.
* **🎙️ GLaDOS-Sprachausgabe:** Galaktische KI-Stimme für Ereignisansagen (*"Welcome back, Commander"*, *"Ship construction completed"*, *"Building construction completed"*).
* **🎛️ Sci-Fi Sound-Overlay:** Zentrales Einstellungs-Panel zur separaten Lautstärkeregelung (Master, Musik, SFX) und Stummschaltung – zugänglich über Startseite und Ingame-HUD.

### 🚀 Flottenbau & Weltraumoperationen
* **Zivile Flotten:** Kolonisierungsschiffe, Logistikfrachter und Transporter gewähren permanente Boni auf Lager, Produktion und Versorgung.
* **Asteroiden-Mining:** Entsende spezialisierte Bergbauschiffe (*Mining Ships*) auf zeitkritische Expeditionen zu Asteroidengürteln für massive Sofort-Ressourcen.
* **Militärflotte:** Fertigung von Leichten Jägern, Schweren Jägern, Zerstörern und Schlachtkreuzern (inkl. individuellem Energie-Upkeep und Power-Toggles).

### ⚔️ Kampfsystem, Feindangriffe & Diplomatie
* **Offensive Raids:** Schicke deine Flotte auf Kampfeinsätze, um Ressourcen und Xenonit als Kriegsbeute (*War Booty*) zu erobern.
* **Feindliche Übergriffe (Raids):** Sobald die erste Offensive gestartet wurde, erwacht eine feindliche Fraktion und attackiert in Intervallen deine Basis!
* **Planetare Verteidigung:** Verringert den Schaden feindlicher Angriffe drastisch (bis zu 85 % Schadensminderung).
* **Diplomatische Deeskalation:** Zahle Tribut über das Diplomatie-Terminal, um Angriffe temporär zu stoppen.

### 🔬 Forschung & Nano-Bot-Schwärme
* **Technologiebaum:** Schalte neue Baumöglichkeiten, Effizienzboni und Schiffsklassen frei.
* **Nano-Bots:** Revolutionäre Technologie, die die globalen Baukosten für Gebäude um bis zu 50 % senkt. Inklusive toggelbarer Partikel-Visualisierung im HUD.

### 👤 Spielerprofil & Flottenkommando
* **User-Overlay:** Spielerprofil-Dashboard zur Anpassung des Kommandantennamens, Aktualisierung von E-Mail und Passwort mit Sichtbarkeits-Toggle.
* **Sicherheit & Reset:** Bestätigungsdialoge für vollständigen Spielstand-Reset und Account-Löschung.

### ⏳ Offline-Fortschritt & Cloud-Save
* **Automatische Offline-Berechnung:** Beim Wiedereinloggen kalkuliert das System akkumulierte Ressourcen, fertiggestellte Gebäude und beendete Flottenmissionen präzise nach.
* **Echtzeit-Synchronisation:** Nahtlose Speicherung aller Spielfortschritte in Google Cloud Firestore.

### 🪐 Visuelle 3D-Effekte & Sci-Fi HUD
* **3D-Schwarzes-Loch (Three.js):** Eigene GLSL-Shader für Akkretionsscheibe, Gravitationslinseneffekt (Lensing) und Post-Processing-Bloom (`UnrealBloomPass`).
* **Mobiles & responsives HUD:** Optimierte HUD-Ansichten mit mobiler Ressourcenleiste, vertikalem Energiebalken und dynamischen Planeten- & Satelliten-Renderings mit verfeinerten Drop-Shadows.
* **🎨 Zentralisiertes SVG-Icon-System:** CSS-basierte SVG-Masken mit Glow-Effekten für Ressourcen, Schiffsklassen und Aktionen (`_icons.scss`).

---

## 🛠️ Technologie-Stack

| Bereich | Technologien |
| :--- | :--- |
| **Frontend Framework** | [Angular 21](https://angular.dev/) (Signals, Standalone Components, Modern Control Flow) |
| **Programmiersprache** | [TypeScript 5.9](https://www.typescriptlang.org/) |
| **3D Rendering & WebGL** | [Three.js 0.185](https://threejs.org/) (OrbitControls, EffectComposer, UnrealBloomPass, Custom GLSL) |
| **Styling & UI** | SCSS, Custom Sci-Fi Theme & Design Tokens, Centralized SVG-Mask Icons (`_icons.scss`), Responsive HUD |
| **Audio-Engine** | HTML5 Audio & Angular Signals `AudioService` (Soundtrack, SFX, GLaDOS-Sprachausgabe, Sound-Overlay) |
| **Backend & Auth** | [Firebase 12](https://firebase.google.com/) (Firebase Auth: E-Mail/Passwort & Anonymer Gastzugang, Cloud Firestore) |
| **Performance & PWA** | Service Worker (`sw.js`), Custom IndexedDB/Memory `ImageCacheService`, Preload Pipeline |
| **Testing & Tooling** | [Vitest 4](https://vitest.dev/), jsdom, Prettier, Angular CLI 21 |

---

## 🚀 Schnellstart & Installation

### Voraussetzungen
* [Node.js](https://nodejs.org/) (Version `18.x` oder `20.x+` LTS empfohlen)
* [npm](https://www.npmjs.com/) (Version `9.x` oder neuer)

### 1. Repository klonen
```bash
git clone https://github.com/Jan-OliverKaemmererDev/stellaris-builder-2.0.git
cd stellaris-builder-2.0
```

### 2. Abhängigkeiten installieren
```bash
npm install
```

### 3. Firebase konfigurieren
Überprüfe die Firebase-Konfiguration in `src/environments/environment.ts` bzw. `src/environments/environment.development.ts`:
```typescript
export const environment = {
  production: false,
  firebase: {
    apiKey: "DEIN_API_KEY",
    authDomain: "dein-projekt.firebaseapp.com",
    projectId: "dein-projekt",
    storageBucket: "dein-projekt.firebasestorage.app",
    messagingSenderId: "DEINE_SENDER_ID",
    appId: "DEINE_APP_ID"
  }
};
```

### 4. Entwicklungsserver starten
```bash
npm start
# oder
ng serve -o
```
Die Anwendung öffnet sich automatisch unter `http://localhost:4200/`.

---

## 📜 Verfügbare Skripte

| Befehl | Beschreibung |
| :--- | :--- |
| `npm start` | Startet den Angular-Entwicklungsserver mit Hot-Reloading und öffnet den Browser (`ng serve -o`). |
| `npm run build` | Kompiliert das Projekt für die Produktion im Ordner `dist/`. |
| `npm run watch` | Führt einen kontinuierlichen Entwicklungs-Build bei Dateiänderungen aus. |
| `npm test` | Führt die Unit-Tests via [Vitest](https://vitest.dev/) aus. |

---

## 📁 Architektur & Projektstruktur

```text
stellaris-builder-2.0/
├── public/
│   ├── assets/                 # Grafiken, Icons, Schiff-Assets & Hintergründe
│   │   ├── backgrounds/        # Sci-Fi Hintergrundgrafiken
│   │   ├── icons/              # Spiel-Icons & Fallbacks
│   │   ├── img/                # Modul-Bilder (Mining, Fleet, Energy, ...)
│   │   └── logo.png            # Offizielles Spiel-Logo
│   ├── sounds/                 # Audiomaterial & Sound-Assets
│   │   ├── fleet/              # Flotten- und Missions-Sounds
│   │   ├── glados-voice/       # KI-Sprachansagen (GLaDOS-Voice)
│   │   └── music/              # Ambient-Soundtrack (Paradigm, Chronometry)
│   └── sw.js                   # Service Worker für Asset-Caching
├── src/
│   ├── app/
│   │   ├── bridge/             # Kommandozentrale & Übersicht
│   │   ├── components/         # Wiederverwendbare UI-, Audio- & 3D-Komponenten
│   │   │   ├── black-hole/             # Three.js 3D WebGL Schwarzes Loch
│   │   │   ├── diplomacy-dialog/       # Diplomatie & Friedensverhandlungen
│   │   │   ├── enemy-attack-overlay/   # Benachrichtigung bei Feindangriffen
│   │   │   ├── icon/                   # Zentralisierte SVG-Icon-Komponente
│   │   │   ├── lightbox/               # Vollbild-Bildbetrachter
│   │   │   ├── nano-bots-overlay/      # Nano-Bot-Partikelanzeige
│   │   │   ├── offline-progress-dialog/# Dialog für Offline-Ressourcenberechnung
│   │   │   ├── pixel-progress-bar/     # Sci-Fi Fortschrittsanzeige
│   │   │   ├── skill-node/             # Gebäude-/Forschungs-Knoten mit Power-Toggle
│   │   │   ├── sound-overlay/          # Audio-Dashboard (BGM, SFX, Voice, Lautstärke)
│   │   │   └── user-overlay/           # Spielerprofil, Sicherheit & Spielstand-Reset
│   │   ├── constants/          # Ressourcen- & Icon-Konstanten
│   │   ├── game-layout/        # Haupt-HUD, vertikaler Energiebalken & mobile Navigation
│   │   ├── guards/             # AuthGuard zum Schutz der Spielrouten
│   │   ├── landing-page/       # Startseite mit Login, Registrierung & 3D-Canvas
│   │   ├── legal-notice/       # Impressum im Sci-Fi Design
│   │   ├── pages/              # Hauptbereiche des Spiels
│   │   │   ├── energy/         # Energieerzeugung & Kraftwerksbau
│   │   │   ├── fleet/          # Raumschiff-Werft, Asteroiden-Mining & Flottentoggle
│   │   │   ├── infrastructure/ # Raffinerien, Biolabore & Verteidigung
│   │   │   ├── mining/         # Minen für Eisen, Silber, Gold
│   │   │   ├── research/       # Forschung & Nano-Bot-Entwicklung
│   │   │   ├── rules/          # Ausführliches Regelwerk & Upkeep-Tabellen
│   │   │   └── trade/          # Ressourcenmarkt & Handel
│   │   ├── privacy-policy/     # Datenschutzerklärung
│   │   ├── services/           # Business-Logik & State-Management
│   │   │   ├── audio.service.ts        # Soundtrack-Player, SFX & Sprachausgabe
│   │   │   ├── enemy-attack.service.ts # Raids, Kampflogik & Schadensberechnung
│   │   │   ├── game-math.utils.ts      # Baukostenformeln & Upkeep-Kalkulationen
│   │   │   ├── game-state.service.ts   # Zentrales State-Management & Power-States
│   │   │   ├── image-cache.service.ts  # Caching für schnelle Bildladezeiten
│   │   │   └── settings.service.ts     # Benutzereinstellungen
│   │   └── app.routes.ts       # Routen-Konfiguration
│   ├── environments/           # Firebase- & Umgebungs-Konfigurationen
│   └── styles/
│       └── _icons.scss         # Zentrales SVG-Masken- & Glow-Icon-System
│   └── styles.scss             # Globale Stylesheets & Sci-Fi Design Tokens
├── angular.json                # Angular Workspace Konfiguration
├── package.json                # Projekt-Metadaten & Abhängigkeiten
└── tsconfig.json               # TypeScript Compiler-Konfiguration
```

---

## 📖 Spielregeln & Tipps für den Einstieg

1. **Aller Anfang ist Bergbau:** Errichte zuerst Minen für Eisen, Silber und Gold im Bereich **Mining**.
2. **Energie zuerst absichern:** Jede neue Ausbaustufe und jedes Schiff verursacht laufende Energiekosten. Baue rechtzeitig Solarkraftwerke im Bereich **Energie**, um Produktionsausfälle durch Strommangel zu vermeiden.
3. **Notfall-Abschaltung nutzen:** Droht ein Blackout? Nutze das **Blitz-Icon** auf Gebäuden oder Schiffen, um diese temporär zu deaktivieren. Sie verbrauchen dann 0 Energie und entlasten sofort das Netz.
4. **Infrastruktur ausbauen:** Errichte eine **Raffinerie**, um Xenonit zu gewinnen, und **Biolabore**, um Nahrung für deine Crew bereitzustellen.
5. **Asteroiden-Mining nutzen:** Baue Bergbauschiffe und schicke sie auf Expeditionen – sie bringen wertvolle Ressourcen-Schübe in Rekordzeit ein!
6. **Verteidigung nicht vergessen:** Sobald du Feindschiffe angreifst, werden feindliche Flotten auf dich aufmerksam. Baue die **Planetare Verteidigung** aus, um geplünderte Ressourcen bei Angriffen zu minimieren!
7. **Sound & Profil anpassen:** Über die Icons im oberen HUD hast du jederzeit Zugriff auf das **Sound-Overlay** (Lautstärke, BGM, SFX) und das **User-Overlay** (Profil, Passwort, Spielstand-Reset).

---

## 🤝 Mitwirken & Beitragen

Beiträge, Fehlerberichte und Feature-Vorschläge sind jederzeit willkommen!
1. Repository forken (`Fork`).
2. Feature-Branch erstellen (`git checkout -b feature/NeuesFeature`).
3. Änderungen committen (`git commit -m 'feat: Neues Feature hinzufügen'`).
4. Auf den Branch pushen (`git push origin feature/NeuesFeature`).
5. Einen **Pull Request** erstellen.

---

## 📄 Lizenz

Dieses Projekt ist lizenziert unter der **MIT-Lizenz** – siehe die [LICENSE](LICENSE)-Datei für Details.

---

<div align="center">
  <sub>Entwickelt mit Leidenschaft für Sci-Fi & moderne Web-Technologien von <a href="https://github.com/Jan-OliverKaemmererDev">Jan-Oliver Kämmerer</a>.</sub>
</div>
