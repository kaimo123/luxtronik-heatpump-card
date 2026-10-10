/*!
 * Luxtronik Heatpump Card  v2.7.0
 * Maasoojuspumba skeemikaart (Home Assistant + BenPru/luxtronik).
 * Iga andur on valikuline: mida pole seadistatud ega leita, seda ei kuvata.
 */
const LHC_VERSION = "2.7.0";
const W = 1460, D = 60; // D = parempoolse osa nihe
const HOT = "#e5533d", COLD = "#3d8be5", BRINE = "#4fb3d9", MIX = "#f0a030", GROUND = "#a98467";
const FX = [1030, 1160, 1290], LP = 88; // termostaatide veergude x ja ridade samm (sama mis radiaatoritel)
const MAX_ITEMS = 9;                     // max termostaate põrandal / radiaatoritel
const COP_CATS = ["heating", "dhw", "total"], COP_PERIODS = ["h24", "d7", "month", "year"];
const COP_T = {
  et: { heating: "Küte", dhw: "Tarbevesi", total: "Kokku", h24: "24 h (COP)", d7: "7 päeva (COP)", month: "Kuu (COP)", year: "Aasta (SCOP)",
        loading: "Laen COP statistikat…", error: "COP statistika lugemine ebaõnnestus: " },
  en: { heating: "Heating", dhw: "Hot water", total: "Total", h24: "24 h (COP)", d7: "7 days (COP)", month: "Month (COP)", year: "Year (SCOP)",
        loading: "Loading COP statistics…", error: "Failed to read COP statistics: " },
};
/* ηs piirid (EL 811/2013, soojuspumpade ruumisoojendid) – ligikaudne näit */
const COP_EU = {
  eu_medium: [["A+++", 150], ["A++", 125], ["A+", 98], ["A", 90], ["B", 82], ["C", 75], ["D", 36], ["E", 34], ["F", 30], ["G", -1e9]],
  eu_low: [["A+++", 175], ["A++", 150], ["A+", 123], ["A", 115], ["B", 107], ["C", 100], ["D", 61], ["E", 59], ["F", 55], ["G", -1e9]],
};
const COP_CLS = { "A+++": "#00a651", "A++": "#4cb848", "A+": "#8dc63f", A: "#c4d600", B: "#ffe600", C: "#fdb913", D: "#f58220", E: "#ee3e2c", F: "#e31e24", G: "#c1272d" };
const copFmt = (n, d = 1) => (n == null || !isFinite(n) ? "—" : (Math.round(n * 10 ** d) / 10 ** d).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }));
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

const I18N = {
  et: {
    collector: "MAAKOLLEKTOR", heatpump: "SOOJUSPUMP", buffer: "KÜTTE AKUPAAK", dhw: "TARBEVEE AKUPAAK",
    floor: "PÕRANDAKÜTE", radiators: "RADIAATORID", mixer: "SEGAMISSÕLM",
    brine_in: "Sisse ", brine_out: "Välja ", outdoor: "Väljas: ", outdoor_avg: "Väljas keskm.: ",
    hot_gas: "Kuumgaas: ", flow_in_target: "Tagasiv. siht: ", compressor: "Kompressor: ", cop: "COP: ",
    capacity: "Võimsus: ", hours: "Töötunde: ", defrost: "Sulatus: ", additional_heating: "Lisaküte: ",
    flow: "Pealevool ", return: "Tagasivool ", target: "Siht ", temp: "Temp ", water: "Vesi ",
    floor_n: "Põrand ", rad_n: "Radiaator ", floor_return: "Põrandalt ",
  },
  en: {
    collector: "GROUND LOOP", heatpump: "HEAT PUMP", buffer: "HEATING BUFFER", dhw: "DHW TANK",
    floor: "UNDERFLOOR HEATING", radiators: "RADIATORS", mixer: "MIXING VALVE",
    brine_in: "In ", brine_out: "Out ", outdoor: "Outdoor: ", outdoor_avg: "Outdoor avg: ",
    hot_gas: "Hot gas: ", flow_in_target: "Return target: ", compressor: "Compressor: ", cop: "COP: ",
    capacity: "Capacity: ", hours: "Hours: ", defrost: "Defrost: ", additional_heating: "Aux heater: ",
    flow: "Flow ", return: "Return ", target: "Target ", temp: "Temp ", water: "Water ",
    floor_n: "Floor ", rad_n: "Radiator ", floor_return: "Floor return ",
  },
};

/* Kõik seadistatavad olemite võtmed. Kuvatakse ainult need, mis on seadistatud. */
const ALL_KEYS = [
  "brine_in", "brine_out", "brine_pump", "status", "compressor", "outdoor", "outdoor_avg", "hot_gas",
  "flow_out", "flow_in", "flow_in_target", "cop", "capacity", "hours", "defrost", "additional_heating",
  "heating_pump", "buffer_temp", "buffer_target", "dhw_temp", "dhw_target", "dhw_mode", "dhw_pump",
  "mix_flow", "mix_target", "mix_return", "mix_pump", "heating_mode",
  "rad_pump", "rad_flow", "rad_return", "heat_flow_rate", "source_flow_rate",
];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

class LuxtronikHeatpumpCard extends HTMLElement {
  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    const c = { ...config, ...(config.entities || {}) }; // vana `entities:` jääb toetatuks
    this._cfg = c;
    this._floor = this._list(c.floor, MAX_ITEMS);
    this._rads = this._list(c.radiators, MAX_ITEMS);
    this._extras = this._list(c.extras, 6);
    this._copData = null; this._copErr = null; this._copLast = 0;
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this._sig = null;
    if (this._hass) this._maybeBuild();
  }

  _list(l, max) { return (l || []).slice(0, max).map((i) => (typeof i === "string" ? { entity: i } : i)).filter((i) => i && i.entity); }

  set hass(h) { this._hass = h; if (this._cfg) { this._maybeBuild(); this._update(); this._copFetch(false); } }
  connectedCallback() { if (this._cfg && this._hass) this._copFetch(false); }
  getCardSize() { return 8; }

  static getConfigElement() { return document.createElement("luxtronik-heatpump-card-editor"); }
  static getStubConfig() { return { floor: [], radiators: [] }; }

  _lang() {
    const l = this._cfg.language || (this._hass && this._hass.language) || "et";
    return I18N[String(l).slice(0, 2)] || I18N.en;
  }

  /* Olem on seadistatud või puudub (siis ei kuvata) */
  _ent(key) {
    const c = this._cfg[key];
    return c && typeof c === "string" ? c : null;
  }

  /* Termostaadi nimi: seadistatud `name` või olemi enda nimi */
  _name(e) {
    if (e.name) return e.name;
    const st = this._hass && this._hass.states[e.entity];
    return (st && st.attributes.friendly_name) || e.entity;
  }

  _resolve() {
    const R = {};
    ALL_KEYS.forEach((k) => (R[k] = this._ent(k)));
    return R;
  }

  _maybeBuild() {
    const R = this._resolve();
    this._names = [...this._floor, ...this._rads].map((e) => this._name(e));
    const sig = JSON.stringify([R, this._floor, this._rads, this._extras, this._names, this._cfg.title, this._cfg.language, this._hass.language, this._copCfg(),
      ["show_collector", "show_buffer", "show_dhw", "show_floor", "show_radiators", "show_mixer"].map((k) => this._cfg[k])]);
    if (sig === this._sig) return;
    this._sig = sig;
    this._R = R;
    this._build();
  }

  /* ---------- SVG ---------- */
  _svg() {
    const L = this._lang(), R = this._R, C = this._cfg, o = [];
    const any = (...k) => k.some((x) => R[x]);
    const show = (flag, auto) => (C[flag] !== undefined ? !!C[flag] : auto);
    const mixerOn = show("show_mixer", any("mix_flow", "mix_target", "mix_return", "mix_pump"));
    const floorOn = show("show_floor", this._floor.length > 0 || mixerOn);
    const radOn = show("show_radiators", this._rads.length > 0 || any("rad_pump", "rad_flow", "rad_return"));
    const bufOn = show("show_buffer", any("buffer_temp", "buffer_target") || floorOn || radOn);
    const dhwOn = show("show_dhw", any("dhw_temp", "dhw_target", "dhw_mode", "dhw_pump"));
    const colOn = show("show_collector", any("brine_in", "brine_out", "brine_pump"));

    const box = (x, y, w, h, c, r = 14, op = 0.1, extra = "") =>
      o.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${c}" fill-opacity="${op}" stroke="${c}" stroke-opacity=".7" stroke-width="2" ${extra}/>`);
    const nm = (x, y, s, size = 14) => o.push(`<text class="nm" x="${x}" y="${y}" font-size="${size}"><title>${esc(s)}</title>${esc(cut(s, 15))}</text>`);
    const lbl = (x, y, s, size = 17) => o.push(`<text class="lbl" x="${x}" y="${y}" font-size="${size}">${esc(s)}</text>`);
    const pipe = (d, c, m, w = 6) =>
      o.push(`<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"${m ? ` marker-end="url(#m${m})"` : ""}/>`);
    const val = (x, y, entity, { prefix = "", attr = "", size = 17, bold = false, showOn = "", hideOn = "" } = {}) => {
      if (!entity) return;
      // showOn / hideOn: teise olemi ID – tekst on nähtav ainult siis, kui see olem on "on" / ei ole "on"
      const cond = (showOn ? ` data-show-on="${esc(showOn)}"` : "") + (hideOn ? ` data-hide-on="${esc(hideOn)}"` : "");
      o.push(`<text class="val${bold ? " b" : ""}" x="${x}" y="${y + 6}" font-size="${size}" data-entity="${esc(entity)}" data-attr="${attr}" data-prefix="${esc(prefix)}"${cond}>…</text>`);
    };
    const pump = (x, y, entity, rot = 0) => { // rot: 0 = paremale, 180 = vasakule
      if (!entity) return;
      o.push(`<g class="pump" data-entity="${esc(entity)}" transform="translate(${x},${y}) rotate(${rot})"><circle r="17"/><path d="M-6,-8 L9,0 L-6,8 Z"/></g>`);
    };
    const flow = (entity, paths) => {
      if (!entity || !paths.length) return;
      o.push(`<g class="flow" data-flow="${esc(entity)}" pointer-events="none">${paths.map((d) => `<path d="${d}"/>`).join("")}</g>`);
    };

    // radiaatorite read: ainult nii palju, kui valitud olemeid on (3 tk reas)
    // põrandakütte maht: kompaktsed plaadid (3 reas), nagu radiaatoritel; plaadirida asub kahe toru vahel
    const Y0 = 110;                                // põranda pealevoolutoru y (samal kõrgusel akupaagi väljundiga)
    const nFR = Math.max(1, Math.ceil(this._floor.length / 3));
    const FYs = Array.from({ length: nFR + 1 }, (_, k) => Y0 + LP * k); // torude y-d
    if (FYs.length % 2) FYs.push(FYs[FYs.length - 1] + 40);            // serpentiin peab lõppema vasakul
    const FLOOR_Y = FYs[FYs.length - 1];           // põranda tagasivoolutoru y
    const FLOOR_BOTTOM = FLOOR_Y + 30;             // põrandakütte raami alumine serv
    let serp = `M940,${Y0} H1362`;                 // torulaine (serpentiin) põranda sees
    for (let k = 1; k < FYs.length; k++) serp += ` V${FYs[k]} H${k % 2 ? 958 : 1362}`;
    serp += " H940";
    const RB = floorOn ? FLOOR_BOTTOM + 40 : 450; // radiaatorite raami ülemine serv
    const nRows = radOn ? Math.max(1, Math.ceil(this._rads.length / 3)) : 0;
    const RY = [0, 112, 224].slice(0, nRows).map((d) => RB + 60 + d);
    const RET_BOTTOM = nRows ? RY[nRows - 1] + 116 : 850; // radiaatorite tagasivoolu põhitoru y
    const H = Math.max(650, dhwOn ? 720 : 0, floorOn ? FLOOR_BOTTOM + 30 : 0, nRows ? RET_BOTTOM + 40 : 0);
    o.push(`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><defs>`);
    [["h", HOT], ["c", COLD], ["b", BRINE]].forEach(([n, c]) =>
      o.push(`<marker id="m${n}" viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth="16" markerHeight="16" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`));
    o.push("</defs>");

    /* --- maakollektor --- */
    if (colOn) {
      box(20, 150, 180, 450, GROUND); lbl(110, 180, L.collector);
      pipe("M200,270 H50 V306 H180 V342 H50 V378 H180 V414 H50 V450 H200", GROUND, null, 5);
      pipe("M200,270 H340", BRINE, "b"); pipe("M340,450 H200", COLD, "c");
      flow(R.brine_pump, ["M200,270 H340", "M340,450 H50 V414 H180 V378 H50 V342 H180 V306 H50 V270 H200"]);
      pump(270, 450, R.brine_pump, 180); // toru liigub vasakule (soojuspumbalt kollektorisse)
      val(270, 245, R.brine_in, { prefix: L.brine_in }); val(270, 492, R.brine_out, { prefix: L.brine_out });
      // kollektori läbivool – ainult siis, kui kollektori pump töötab
      val(270, 418, R.source_flow_rate, { size: 15, showOn: R.brine_pump || "" });
    }

    /* --- soojuspump --- */
    box(340, 150, 200, 450, "#888"); lbl(440, 178, L.heatpump);
    const rows = [["status", "", true], ["compressor"], ["outdoor"], ["outdoor_avg"], ["hot_gas"], ["flow_in_target"],
                  ["cop", "", true], ["capacity"], ["hours"], ["defrost"], ["additional_heating"]]
      .filter(([k]) => R[k]).map(([k, , b]) => ({ id: R[k], prefix: k === "status" ? "" : L[k], bold: !!b }));
    this._extras.forEach((e) => {
      const st = this._hass.states[e.entity];
      rows.push({ id: e.entity, prefix: (e.name || (st && st.attributes.friendly_name) || "") + (e.name === "" ? "" : ": ") });
    });
    const step = rows.length > 1 ? Math.min(36, (575 - 208) / (rows.length - 1)) : 0;
    rows.forEach((r, i) => val(440, 208 + i * step, r.id, { prefix: r.prefix, bold: r.bold }));

    /* --- ühine pea- ja tagasivoolutoru soojuspumbalt mõlemale paagile --- */
    const hpOut = R.flow_out, hpIn = R.flow_in;
    if (bufOn || dhwOn) {
      if (bufOn && dhwOn) {
        pipe("M540,200 H700", HOT, "h"); pipe("M640,200 V480 H700", HOT, "h");
        pipe("M700,560 H540", COLD, "c"); pipe(`M700,330 H${640 + 8} A8,8 0 0 0 ${640 - 8},330 H590 V560`, COLD);
        flow(R.heating_pump, ["M540,200 H700", `M700,330 H648 A8,8 0 0 0 632,330 H590 V560 H540`]);
        flow(R.dhw_pump, ["M640,200 V480 H700", "M700,560 H540"]);
      } else if (bufOn) {
        pipe("M540,200 H700", HOT, "h"); pipe("M700,330 H590 V560 H540", COLD, "c");
        flow(R.heating_pump, ["M540,200 H700", "M700,330 H590 V560 H540"]);
      } else {
        pipe("M540,200 H640 V480 H700", HOT, "h"); pipe("M700,560 H540", COLD, "c");
        flow(R.dhw_pump, ["M540,200 H640 V480 H700", "M700,560 H540"]);
      }
      pump(590, 200, R.heating_pump);
      if (dhwOn) pump(670, 480, R.dhw_pump);
      // soojushulga läbivool: tarbevee pumba juures kui tarbevett tehakse, muul ajal kütte pumba juures
      if (bufOn) val(590, 234, R.heat_flow_rate, { size: 15, showOn: R.heating_pump || "", hideOn: R.dhw_pump || "" });
      if (dhwOn) val(668, 518, R.heat_flow_rate, { size: 15, showOn: R.dhw_pump || "" });
      val(620, 160, hpOut, { prefix: L.flow, bold: true }); val(620, 592, hpIn, { prefix: L.return, bold: true });
    }

    /* --- parempoolne osa (nihutatud) --- */
    o.push(`<g transform="translate(${D},0)">`);
    const names = this._names || [];
    const nameOf = (list, i, offset) => names[offset + i] || list[i].entity;
    if (bufOn) {
      box(640, 90, 120, 280, HOT, 14, 0.1, R.buffer_temp ? `data-fill="${esc(R.buffer_temp)}"` : "");
      lbl(700, 138, L.buffer, 14);
      val(700, 190, R.buffer_temp, { prefix: L.temp, size: 19, bold: true }); val(700, 232, R.buffer_target, { prefix: L.target });
    }
    if (dhwOn) {
      box(640, 430, 120, 260, HOT, 14, 0.1, R.dhw_temp ? `data-fill="${esc(R.dhw_temp)}"` : "");
      lbl(700, 458, L.dhw, 14);
      val(700, 520, R.dhw_temp, { prefix: L.water, size: 19, bold: true }); val(700, 562, R.dhw_target, { prefix: L.target });
      val(700, 604, R.dhw_mode);
    }
    const loads = floorOn || radOn;
    const supTrunkEnd = radOn ? RY[0] : Y0;
    if (bufOn && loads) {
      pipe(`M760,110 H830 V${supTrunkEnd}`, HOT);
      pipe(`M800,340 H760`, COLD, "c");
      if (radOn) pipe(`M800,${RET_BOTTOM} V340`, COLD);
      if (floorOn) pipe(`M800,${FLOOR_Y} V340`, COLD);
    }
    if (floorOn) {
      box(940, 40, 440, FLOOR_BOTTOM - 40, MIX); lbl(1160, 64, L.floor);
      pipe(`M830,${Y0} H940`, HOT, "h");
      pipe(radOn ? `M940,${FLOOR_Y} H838 A8,8 0 0 0 822,${FLOOR_Y} H800` : `M940,${FLOOR_Y} H800`, COLD, "c");
      pipe(serp, MIX, null, 8);
      if (mixerOn) {
        lbl(885, Y0 - 20, L.mixer, 14);
        o.push(`<circle cx="905" cy="${Y0}" r="18" fill="#222" fill-opacity=".35" stroke="${MIX}" stroke-width="3"/><path d="M893,${Y0 - 8} L917,${Y0 + 8} M893,${Y0 + 8} L917,${Y0 - 8}" stroke="${MIX}" stroke-width="3"/>`);
        pump(862, Y0, R.mix_pump);
        val(885, Y0 + 40, R.mix_flow, { prefix: L.flow }); val(885, Y0 + 70, R.mix_target, { prefix: L.target });
        val(885, Y0 + 100, R.heating_mode);
        val(885, FLOOR_Y + 30, R.mix_return, { prefix: L.floor_return });
      }
      // põrandakütte voolu animatsioon (tagasivool jätkub akupaagini, kui radiaatoreid pole)
      flow(R.mix_pump, [`${serp.replace(`M940,${Y0}`, `M830,${Y0}`).replace(/ H940$/, "")} H800 V340${radOn ? "" : " H760"}`]);
      // kompaktsed plaadid, 3 reas – sama kujundus kui radiaatoritel
      this._floor.forEach((f, n) => {
        const ys = FYs[Math.floor(n / 3)], cx = FX[n % 3];
        box(cx - 58, ys + 12, 116, 64, "#888", 8, 0.15);
        nm(cx, ys + 28, nameOf(this._floor, n, 0), 13);
        val(cx, ys + 47, f.entity, { attr: "current_temperature", size: 18, bold: true });
        val(cx, ys + 65, f.entity, { attr: "temperature", prefix: "→ ", size: 14 });
      });
    }
    if (radOn) {
      box(940, RB, 440, RET_BOTTOM + 20 - RB, HOT); lbl(1160, RB + 28, L.radiators);
      const y0 = RY[0], yl = RY[nRows - 1], xs = 960, xr = 1362;
      // pealevool: magistraal → esimene rida, tõusutoru vasakul, järgmised read
      pipe(`M830,${y0} H1340`, HOT, "h");
      if (nRows > 1) pipe(`M${xs},${y0} V${yl}`, HOT);
      RY.slice(1).forEach((ys) => pipe(`M${xs},${ys} H1340`, HOT, "h"));
      // tagasivool: read → parempoolne tõusutoru → põhitoru → magistraal
      RY.forEach((ys) => pipe(`M1000,${ys + 88} H${xr}`, COLD));
      pipe(`M${xr},${y0 + 88} V${RET_BOTTOM}`, COLD); pipe(`M${xr},${RET_BOTTOM} H800`, COLD, "c");
      val(885, y0 - 34, R.rad_flow, { prefix: L.flow });
      val(885, RET_BOTTOM - 24, R.rad_return, { prefix: L.return });
      // radiaator ilmub ainult siis, kui selle olem on valitud
      this._rads.forEach((r, n) => {
        const ys = RY[Math.floor(n / 3)], cx = FX[n % 3];
        box(cx - 58, ys + 12, 116, 64, "#888", 8, 0.15);
        pipe(`M${cx},${ys} V${ys + 12}`, HOT, null, 4); pipe(`M${cx},${ys + 76} V${ys + 88}`, COLD, null, 4);
        nm(cx, ys + 28, nameOf(this._rads, n, this._floor.length), 13);
        val(cx, ys + 47, r.entity, { attr: "current_temperature", size: 18, bold: true });
        val(cx, ys + 65, r.entity, { attr: "temperature", prefix: "→ ", size: 14 });
      });
    }
    if (bufOn && loads) {
      const p = [`M760,110 H830 V${supTrunkEnd}`];
      if (radOn) {
        const y0 = RY[0], yl = RY[nRows - 1], xs = 960, xr = 1362;
        const rp = [`M830,${y0} H1340`];
        if (nRows > 1) rp.push(`M${xs},${y0} V${yl}`);
        RY.slice(1).forEach((ys) => rp.push(`M${xs},${ys} H1340`));
        this._rads.forEach((r, n) => { const ys = RY[Math.floor(n / 3)], cx = FX[n % 3]; rp.push(`M${cx},${ys} V${ys + 12}`, `M${cx},${ys + 76} V${ys + 88}`); });
        RY.forEach((ys) => rp.push(`M1000,${ys + 88} H${xr}`));
        rp.push(`M${xr},${y0 + 88} V${RET_BOTTOM} H800 V340 H760`);   // tagasivool: radiaatoritelt akupaaki
        if (R.rad_pump) flow(R.rad_pump, rp); else p.push(...rp);       // oma pump → oma animatsioon
        pump(885, y0, R.rad_pump);
      }
      flow(R.heating_pump, p);
    }
    o.push("</g></svg>");
    return o.join("");
  }

  /* ---------- COP / SCOP statistikast (kaardi all) ---------- */
  _copCfg() { return Object.keys(this._cfg).filter((k) => k.startsWith("cop_")).sort().map((k) => [k, this._cfg[k]]); }
  _copId(k, f) { return this._cfg[`cop_${k}_${f}`] || null; }
  _copIds() {
    const ids = new Set();
    COP_CATS.forEach((k) => ["produced", "consumed", "aux", "aux2"].forEach((f) => { const v = this._copId(k, f); if (v) ids.add(v); }));
    return [...ids];
  }
  _copEvery() { return Math.max(1, Number(this._cfg.cop_refresh_minutes) || 60) * 60000; }

  async _copFetch(force) {
    if (!this._hass || !this._cfg || this._copBusy) return;
    if (!force && Date.now() - this._copLast < this._copEvery()) return;
    const ids = this._copIds();
    if (!ids.length || this._cfg.show_cop === false) return;
    this._copBusy = true;
    try {
      const now = Date.now();
      const days = Math.max(7, Number(this._cfg.cop_month_days) || 30, Number(this._cfg.cop_year_days) || 365);
      const call = (period, from) => this._hass.callWS({
        type: "recorder/statistics_during_period",
        start_time: new Date(from).toISOString(), statistic_ids: ids, period, types: ["change"], units: { energy: "kWh" },
      });
      const [day, hour] = await Promise.all([call("day", now - (days + 1) * 864e5), call("hour", now - 25 * 3600e3)]);
      this._copData = { day, hour, now }; this._copErr = null; this._copLast = Date.now();
    } catch (e) {
      this._copErr = (e && (e.message || e.code)) || String(e);
      this._copLast = Date.now() - this._copEvery() + 60000; // proovi uuesti ~1 min pärast
    }
    this._copBusy = false;
    this._copRender();
  }

  _copSum(series, id, since) {
    const arr = series && series[id];
    if (!arr || !arr.length) return null;
    let s = 0, n = 0;
    arr.forEach((b) => { if (new Date(b.start).getTime() >= since && b.change != null && isFinite(b.change)) { s += b.change; n++; } });
    return n ? s : null;
  }

  _copSince(p) {
    const now = new Date(this._copData.now), c = this._cfg;
    const mid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const back = (d) => { const x = new Date(mid); x.setDate(x.getDate() - (d - 1)); return x.getTime(); };
    return p === "h24" ? now.getTime() - 24 * 3600e3 : p === "d7" ? back(7)
      : p === "month" ? back(Number(c.cop_month_days) || 30) : back(Number(c.cop_year_days) || 365);
  }

  /* Soojus, elekter ja lisaküte liidetakse ainult nendest ajavahemikest, kus soojuse JA elektri andmed on olemas
     (muidu moonutab erineva ajalooga andur COP-i, nt soojus 365 päeva, elekter 30 päeva). */
  _copCat(k, p) {
    const series = p === "h24" ? this._copData.hour : this._copData.day, since = this._copSince(p);
    const map = (f) => {
      const id = this._copId(k, f), arr = id && series && series[id];
      if (!id) return undefined;                       // andurit pole seadistatud
      const m = new Map();
      (arr || []).forEach((b) => { const t = new Date(b.start).getTime(); if (t >= since && b.change != null && isFinite(b.change)) m.set(t, b.change); });
      return m;
    };
    const P = map("produced"), C = map("consumed"), A = [map("aux"), map("aux2")].filter(Boolean);
    const sum = (m, keys) => { if (!m || !keys.length) return null; let s = 0; keys.forEach((t) => { s += m.get(t) || 0; }); return s; };
    let keys;
    if (P && C) keys = [...P.keys()].filter((t) => C.has(t));
    else keys = [...((P || C) ? (P || C).keys() : [])];
    return { p: sum(P, keys), c: sum(C, keys), a: A.length ? A.reduce((x, m) => x + sum(m, keys), 0) : null };
  }

  _copRow(k, p) {
    let r = this._copCat(k, p);
    if (k === "total" && !this._copId("total", "produced") && !this._copId("total", "consumed")) { // kokku = küte + tarbevesi
      const parts = ["heating", "dhw"].map((x) => this._copCat(x, p));
      const add = (f) => { const v = parts.map((x) => x[f]).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) : null; };
      r = { p: add("p"), c: add("c"), a: add("a") };
    }
    const cons = r.c == null ? null : r.c + (this._cfg.cop_aux_included ? 0 : r.a || 0);
    return { cop: r.p != null && cons != null && cons > 0 ? r.p / cons : null, heat: r.p, elec: cons };
  }

  _copClass(cop) {
    if (cop == null) return null;
    const eta = (cop / 2.5) * 100 - 3; // ηs ≈ SCOP / 2,5 − 3 %
    return (COP_EU[this._cfg.cop_class_mode] || COP_EU.eu_low).find(([, min]) => eta >= min)[0];
  }

  _copColor(cop) { // 1 … punane, 5 … roheline
    if (cop == null) return "var(--secondary-text-color)";
    return `hsl(${Math.round(120 * Math.max(0, Math.min(1, (cop - 1) / 4)))} 65% 42%)`;
  }

  _copHtml() {
    const c = this._cfg, ids = this._copIds();
    if (!ids.length || c.show_cop === false) return "";
    const L = COP_T[String(c.language || (this._hass && this._hass.language) || "et").slice(0, 2)] || COP_T.en;
    if (this._copErr) return `<div class="copmsg err">${L.error}${esc(this._copErr)}</div>`;
    if (!this._copData) return `<div class="copmsg">${L.loading}</div>`;
    const cats = COP_CATS.filter((k) => c[`cop_show_${k}`] !== false).filter((k) => this._copId(k, "produced") || this._copId(k, "consumed") || (k === "total" && (this._copId("heating", "produced") || this._copId("dhw", "produced"))));
    if (!cats.length) return "";
    const head = `<tr><th></th>${COP_PERIODS.map((p) => `<th>${L[p]}</th>`).join("")}</tr>`;
    const rows = cats.map((k) => {
      const tds = COP_PERIODS.map((p) => {
        const r = this._copRow(k, p);
        const cls = c.cop_show_classes !== false ? this._copClass(r.cop) : null;
        const badge = cls ? `<span class="cls" style="background:${COP_CLS[cls]}">${cls}</span>` : "";
        const en = c.cop_show_energy !== false && r.heat != null ? `<div class="en">${copFmt(r.heat, 0)} / ${copFmt(r.elec, 0)} kWh</div>` : "";
        return `<td><div class="cv" style="color:${this._copColor(r.cop)}">${copFmt(r.cop, 2)}${badge}</div>${en}</td>`;
      }).join("");
      return `<tr><th class="rn">${esc(c[`cop_${k}_name`] || L[k])}</th>${tds}</tr>`;
    }).join("");
    return `<table class="coptbl">${head}${rows}</table>`;
  }

  _copRender() {
    const box = this.shadowRoot && this.shadowRoot.querySelector(".copbox");
    if (box) box.innerHTML = this._copHtml();
  }

  _build() {
    if (!this._cfg || !this.shadowRoot) return;
    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block}
        ha-card{padding:8px;overflow:hidden}
        .title{font-size:var(--ha-card-header-font-size,24px);padding:8px 12px 0}
        svg{width:100%;height:auto;display:block}
        .lbl{fill:var(--secondary-text-color);font-weight:700;letter-spacing:1px;text-anchor:middle}
        .nm{fill:var(--secondary-text-color);text-anchor:middle;font-weight:500}
        .val{fill:var(--primary-text-color);text-anchor:middle;font-weight:500;cursor:pointer;
             stroke:var(--card-background-color);stroke-width:5px;paint-order:stroke;stroke-linejoin:round}
        .val.b{font-weight:700}
        .val.heating{fill:var(--state-climate-heat-color,#ff8c00)}
        .val.missing{opacity:.4}
        .pump{cursor:pointer}
        .pump circle{fill:var(--card-background-color);stroke:var(--secondary-text-color);stroke-width:2}
        .pump path{fill:var(--secondary-text-color)}
        .pump.on circle{stroke:var(--success-color,#4caf50);fill:var(--success-color,#4caf50);fill-opacity:.25}
        .pump.on path{fill:var(--success-color,#4caf50)}
        .flow{display:none}
        .flow.on{display:inline}
        .flow path{fill:none;stroke:#fff;stroke-opacity:.9;stroke-width:3;stroke-linecap:round;
                   stroke-dasharray:2 18;animation:m 1.2s linear infinite}
        @keyframes m{from{stroke-dashoffset:0}to{stroke-dashoffset:-20}}
        .copbox{padding:4px 8px 4px}
        .coptbl{width:100%;border-collapse:collapse;text-align:center}
        .coptbl th{color:var(--secondary-text-color);font-weight:500;font-size:13px;padding:4px 6px}
        .coptbl th.rn{text-align:left;color:var(--primary-text-color);font-size:15px;font-weight:600}
        .coptbl td{padding:8px 6px;border-top:1px solid var(--divider-color)}
        .cv{font-size:22px;font-weight:700;line-height:1.1;display:flex;justify-content:center;align-items:center;gap:6px}
        .en{font-size:11px;color:var(--secondary-text-color);margin-top:2px;white-space:nowrap}
        .cls{font-size:11px;font-weight:700;color:#000;border-radius:4px;padding:1px 5px}
        .copmsg{padding:12px 4px;color:var(--secondary-text-color)} .copmsg.err{color:var(--error-color)}
        @media (max-width:520px){.cv{font-size:17px}.coptbl th{font-size:11px}.en{display:none}}
      </style>
      <ha-card>${this._cfg.title ? `<div class="title">${esc(this._cfg.title)}</div>` : ""}${this._svg()}<div class="copbox"></div></ha-card>`;
    this._copRender();
    this._copFetch(false);
    this.shadowRoot.querySelectorAll("[data-entity]").forEach((el) => {
      const id = el.getAttribute("data-entity");
      el.addEventListener("click", () =>
        this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true })));
    });
  }

  _fmt(id, attr) {
    const s = this._hass.states[id];
    if (!s) return null;
    const unit = (this._hass.config && this._hass.config.unit_system && this._hass.config.unit_system.temperature) || "°C";
    if (attr) {
      const v = s.attributes[attr];
      return v == null || isNaN(v) ? "—" : `${Math.round(v * 10) / 10} ${unit}`;
    }
    if (s.state === "unavailable" || s.state === "unknown") return "—";
    const n = Number(s.state);
    if (s.state !== "" && !isNaN(n)) {
      const u = s.attributes.unit_of_measurement;
      return `${Math.round(n * 10) / 10}${u ? " " + u : ""}`;
    }
    return typeof this._hass.formatEntityState === "function" ? this._hass.formatEntityState(s) : s.state;
  }

  _update() {
    if (!this._hass || !this.shadowRoot || !this._sig) return;
    const st = this._hass.states, root = this.shadowRoot;
    root.querySelectorAll("text.val").forEach((el) => {
      const id = el.getAttribute("data-entity"), attr = el.getAttribute("data-attr");
      const f = this._fmt(id, attr);
      el.classList.toggle("missing", f === null);
      el.textContent = f === null ? "?" : el.getAttribute("data-prefix") + f;
      const s = st[id];
      el.classList.toggle("heating", !!(s && attr === "current_temperature" && s.attributes.hvac_action === "heating"));
    });
    root.querySelectorAll("text.val[data-show-on], text.val[data-hide-on]").forEach((el) => {
      const on = (id) => !!(id && st[id] && st[id].state === "on");
      const so = el.getAttribute("data-show-on"), ho = el.getAttribute("data-hide-on");
      el.style.display = (so && !on(so)) || (ho && on(ho)) ? "none" : "";
    });
    root.querySelectorAll("g.pump").forEach((el) => {
      const s = st[el.getAttribute("data-entity")];
      el.classList.toggle("on", !!s && s.state === "on");
    });
    root.querySelectorAll("g.flow").forEach((el) => {
      const s = st[el.getAttribute("data-flow")];
      el.classList.toggle("on", !!s && s.state === "on");
    });
    root.querySelectorAll("rect[data-fill]").forEach((el) => {
      const s = st[el.getAttribute("data-fill")], t = s ? parseFloat(s.state) : NaN;
      if (isNaN(t)) return;
      const k = Math.max(0, Math.min(1, (t - 20) / 40)); // 20 °C sinine … 60 °C punane
      const c = `hsl(${Math.round(210 * (1 - k))} 75% 50%)`;
      el.setAttribute("fill", c); el.setAttribute("stroke", c); el.setAttribute("fill-opacity", "0.25");
    });
  }
}

/* ---------- Visuaalne redaktor ---------- */
const ED_LABELS = {
  et: {
    title: "Pealkiri", language: "Keel",
    show_collector: "Näita maakollektorit", show_buffer: "Näita kütte akupaaki", show_dhw: "Näita tarbevee paaki",
    show_floor: "Näita põrandaküttet", show_radiators: "Näita radiaatoreid", show_mixer: "Näita segamissõlme",
    brine_in: "Kollektorisse (sisse) temp", brine_out: "Kollektorist (välja) temp", brine_pump: "Kollektori pump",
    status: "Staatus", compressor: "Kompressor", outdoor: "Välistemperatuur", outdoor_avg: "Välistemp. keskmine", hot_gas: "Kuumgaas",
    flow_out: "Pealevool (soojuspumbalt paakidesse)", flow_in: "Tagasivool (paakidest soojuspumbale)", flow_in_target: "Tagasivoolu siht",
    cop: "COP", capacity: "Soojusvõimsus", hours: "Töötunnid", defrost: "Sulatus", additional_heating: "Lisaküte",
    heating_pump: "Kütte ringluspump", buffer_temp: "Kütte akupaagi temperatuur", buffer_target: "Kütte akupaagi siht",
    dhw_temp: "Tarbevee temperatuur", dhw_target: "Tarbevee siht", dhw_mode: "Tarbevee režiim", dhw_pump: "Tarbevee pump",
    mix_flow: "Segamissõlm: pealevool", mix_target: "Segamissõlm: siht", mix_return: "Segamissõlm: põranda tagasivool", mix_pump: "Segamisringi pump", heating_mode: "Kütte režiim",
    rad_pump: "Radiaatorite ringi pump", rad_flow: "Radiaatorid: pealevool", rad_return: "Radiaatorid: tagasivool", g_radcircuit: "Radiaatorite ring",
    heat_flow_rate: "Soojushulga läbivool (kütte/tarbevee pumba juures)", source_flow_rate: "Kollektori läbivool (kollektori pumba juures)",
    floor: "Põrandakütte termostaadid (max 9, nimed YAML-is)", radiators: "Radiaatorite termostaadid (max 9, nimed YAML-is)",
    g_general: "Üldine", g_sections: "Kuvatavad osad", g_hp: "Soojuspump", g_pipe: "Pea- ja tagasivool", g_col: "Maakollektor",
    g_tanks: "Akupaagid", g_mix: "Segamissõlm", g_loads: "Küttekehad",
    g_cop: "COP / SCOP (tabel kaardi all)", g_cop_heating: "COP: küte", g_cop_dhw: "COP: tarbevesi", g_cop_total: "COP: kokku (valikuline – muidu küte + tarbevesi)",
    cop_produced: "Toodetud soojus (kWh andur)", cop_consumed: "Tarbitud elekter (kWh andur)", cop_aux: "Lisaküte (andur)", cop_aux2: "Lisaküte 2 (andur)", cop_name: "Nimi",
    show_cop: "Näita COP / SCOP tabelit", cop_refresh_minutes: "COP uuendamise intervall (min)", cop_month_days: "Kuu pikkus (päeva)", cop_year_days: "Aasta pikkus (päeva)",
    cop_aux_included: "Elektrianduri hulgas on lisaküte juba sees", cop_show_heating: "Näita rida: küte", cop_show_dhw: "Näita rida: tarbevesi", cop_show_total: "Näita rida: kokku", cop_show_energy: "Näita soojuse / elektri kWh", cop_show_classes: "Näita energiaklasse (värvilised märgid)", cop_class_mode: "Klassi tüüp",
  },
  en: {
    title: "Title", language: "Language",
    show_collector: "Show ground loop", show_buffer: "Show heating buffer", show_dhw: "Show DHW tank",
    show_floor: "Show underfloor heating", show_radiators: "Show radiators", show_mixer: "Show mixing valve",
    brine_in: "Ground loop in temp", brine_out: "Ground loop out temp", brine_pump: "Brine pump",
    status: "Status", compressor: "Compressor", outdoor: "Outdoor temperature", outdoor_avg: "Outdoor temp. average", hot_gas: "Hot gas",
    flow_out: "Flow (heat pump → tanks)", flow_in: "Return (tanks → heat pump)", flow_in_target: "Return target",
    cop: "COP", capacity: "Heating capacity", hours: "Operating hours", defrost: "Defrost", additional_heating: "Auxiliary heater",
    heating_pump: "Heating circulation pump", buffer_temp: "Buffer tank temperature", buffer_target: "Buffer tank target",
    dhw_temp: "DHW temperature", dhw_target: "DHW target", dhw_mode: "DHW mode", dhw_pump: "DHW pump",
    mix_flow: "Mixing valve: flow", mix_target: "Mixing valve: target", mix_return: "Mixing valve: floor return", mix_pump: "Mixing circuit pump", heating_mode: "Heating mode",
    rad_pump: "Radiator circuit pump", rad_flow: "Radiators: flow", rad_return: "Radiators: return", g_radcircuit: "Radiator circuit",
    heat_flow_rate: "Heat amount flow rate (shown at heating / DHW pump)", source_flow_rate: "Heat source flow rate (shown at brine pump)",
    floor: "Underfloor thermostats (max 9, names in YAML)", radiators: "Radiator thermostats (max 9, names in YAML)",
    g_general: "General", g_sections: "Visible sections", g_hp: "Heat pump", g_pipe: "Flow and return", g_col: "Ground loop",
    g_tanks: "Tanks", g_mix: "Mixing valve", g_loads: "Heat emitters",
    g_cop: "COP / SCOP (table under the diagram)", g_cop_heating: "COP: heating", g_cop_dhw: "COP: hot water", g_cop_total: "COP: total (optional – otherwise heating + hot water)",
    cop_produced: "Heat produced (kWh sensor)", cop_consumed: "Electricity consumed (kWh sensor)", cop_aux: "Aux heater (sensor)", cop_aux2: "Aux heater 2 (sensor)", cop_name: "Name",
    show_cop: "Show COP / SCOP table", cop_refresh_minutes: "COP refresh interval (min)", cop_month_days: "Month length (days)", cop_year_days: "Year length (days)",
    cop_aux_included: "Consumed sensor already includes aux heater", cop_show_heating: "Show row: heating", cop_show_dhw: "Show row: hot water", cop_show_total: "Show row: total", cop_show_energy: "Show heat / electricity kWh", cop_show_classes: "Show energy classes (colored badges)", cop_class_mode: "Class type",
  },
};

class LuxtronikHeatpumpCardEditor extends HTMLElement {
  setConfig(config) { this._config = config; this._render(); }
  set hass(h) { this._hass = h; if (this._form) { this._form.hass = h; this._form.computeLabel = this._label(); } }
  _label() {
    const l = (this._hass && this._hass.language) || "et";
    const T = ED_LABELS[String(l).slice(0, 2)] || ED_LABELS.en;
    return (s) => {
      const m = /^cop_(heating|dhw|total)_(.+)$/.exec(s.name);
      return (m && T["cop_" + m[2]]) || T[s.name] || T[s.title] || s.name;
    };
  }
  _schema() {
    const e = (name, domain) => ({ name, selector: { entity: { domain } } });
    const full = (k) => ((this._config && this._config[k]) || []).length >= MAX_ITEMS;
    const climates = this._hass ? Object.keys(this._hass.states).filter((id) => id.startsWith("climate.")) : [];
    // kui 9 on täis, jäävad valikust välja kõik climate-olemid → juurde lisada ei saa
    const multi = (name) => ({ name, selector: { entity: { domain: "climate", multiple: true, ...(full(name) ? { exclude_entities: climates } : {}) } } });
    const S = ["sensor"], B = ["binary_sensor", "switch"], CL = ["select", "input_select"], N = ["number", "input_number"];
    const grp = (title, schema) => ({ type: "expandable", name: "", title, schema });
    const T = ED_LABELS[String(((this._hass && this._hass.language) || "et")).slice(0, 2)] || ED_LABELS.en;
    return [
      { name: "title", selector: { text: {} } },
      { name: "language", selector: { select: { options: [{ value: "et", label: "Eesti" }, { value: "en", label: "English" }], mode: "dropdown" } } },
      grp(T.g_sections, ["show_collector", "show_buffer", "show_dhw", "show_floor", "show_radiators", "show_mixer", "show_cop"].map((n) => ({ name: n, selector: { boolean: {} } }))),
      grp(T.g_col, [e("brine_in", S), e("brine_out", S), e("brine_pump", B), e("source_flow_rate", S)]),
      grp(T.g_pipe, [e("flow_out", S), e("flow_in", S), e("flow_in_target", S), e("heating_pump", B), e("heat_flow_rate", S)]),
      grp(T.g_hp, [e("status", S), e("compressor", B), e("outdoor", S), e("outdoor_avg", S), e("hot_gas", S), e("cop", S), e("capacity", S), e("hours", S), e("defrost", B), e("additional_heating", B)]),
      grp(T.g_tanks, [e("buffer_temp", S), e("buffer_target", N), e("dhw_temp", S), e("dhw_target", N), e("dhw_mode", CL), e("dhw_pump", B)]),
      grp(T.g_mix, [e("mix_flow", S), e("mix_target", N), e("mix_return", S), e("mix_pump", B), e("heating_mode", CL)]),
      grp(T.g_radcircuit, [e("rad_flow", S), e("rad_return", S), e("rad_pump", B)]),
      grp(T.g_loads, [multi("floor"), multi("radiators")]),
      grp(T.g_cop, [
        { name: "cop_refresh_minutes", selector: { number: { min: 1, max: 1440, mode: "box" } } },
        { name: "cop_month_days", selector: { number: { min: 1, max: 366, mode: "box" } } },
        { name: "cop_year_days", selector: { number: { min: 7, max: 366, mode: "box" } } },
        { name: "cop_show_heating", selector: { boolean: {} } },
        { name: "cop_show_dhw", selector: { boolean: {} } },
        { name: "cop_show_total", selector: { boolean: {} } },
        { name: "cop_aux_included", selector: { boolean: {} } },
        { name: "cop_show_energy", selector: { boolean: {} } },
        { name: "cop_show_classes", selector: { boolean: {} } },
        { name: "cop_class_mode", selector: { select: { options: [{ value: "eu_low", label: "EU ≤ 35 °C" }, { value: "eu_medium", label: "EU 55 °C" }], mode: "dropdown" } } },
      ]),
      ...["heating", "dhw", "total"].map((k) => grp(T["g_cop_" + k], ["produced", "consumed", "aux", "aux2"].map((f) => e(`cop_${k}_${f}`, S)).concat([{ name: `cop_${k}_name`, selector: { text: {} } }]))),
    ];
  }
  _render() {
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        const value = { ...ev.detail.value };
        Object.keys(value).forEach((k) => { if (value[k] === "" || value[k] === undefined) delete value[k]; });
        let trimmed = false;
        ["floor", "radiators"].forEach((k) => { // kõva piir: max 9 olemit
          if (Array.isArray(value[k]) && value[k].length > MAX_ITEMS) { value[k] = value[k].slice(0, MAX_ITEMS); trimmed = true; }
        });
        this._config = value;
        this._form.schema = this._schema();           // uuenda "täis" olekut
        if (trimmed) this._form.data = value;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: value }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.schema = this._schema();
    this._form.computeLabel = this._label();
    // vaikimisi sisselülitatud lülitid näitavad redaktoris õiget olekut
    const defs = { show_cop: true, cop_show_heating: true, cop_show_dhw: true, cop_show_total: true, cop_show_classes: true, cop_show_energy: true };
    this._form.data = { ...defs, ...(this._config || {}) };
  }
}

customElements.define("luxtronik-heatpump-card", LuxtronikHeatpumpCard);
customElements.define("luxtronik-heatpump-card-editor", LuxtronikHeatpumpCardEditor);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "luxtronik-heatpump-card",
  name: "Luxtronik Heatpump Card",
  description: "Maasoojuspumba skeem animeeritud vooluga. Kõik andurid valikulised.",
  preview: false,
});
console.info(`%c LUXTRONIK-HEATPUMP-CARD %c v${LHC_VERSION} `, "color:white;background:#e5533d;font-weight:700", "color:#e5533d");
