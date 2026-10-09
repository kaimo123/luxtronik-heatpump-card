/*!
 * Luxtronik Heatpump Card  v2.0.0
 * Maasoojuspumba skeemikaart (Home Assistant + BenPru/luxtronik).
 * Iga andur on valikuline: mida pole seadistatud ega leita, seda ei kuvata.
 */
const LHC_VERSION = "2.0.0";
const W = 1360, H = 740, D = 60; // D = parempoolse osa nihe
const HOT = "#e5533d", COLD = "#3d8be5", BRINE = "#4fb3d9", MIX = "#f0a030", GROUND = "#a98467";
const FX = [1005, 1110, 1215], FY = [125, 225, 325];

const I18N = {
  et: {
    collector: "MAAKOLLEKTOR", heatpump: "SOOJUSPUMP", buffer: "KÜTTE AKUPAAK", dhw: "TARBEVEE AKUPAAK",
    floor: "PÕRANDAKÜTE", radiators: "RADIAATORID", mixer: "SEGAMISSÕLM",
    brine_in: "Sisse ", brine_out: "Välja ", outdoor: "Väljas: ", outdoor_avg: "Väljas keskm.: ",
    hot_gas: "Kuumgaas: ", flow_in_target: "Tagasiv. siht: ", compressor: "Kompressor: ", cop: "COP: ",
    capacity: "Võimsus: ", hours: "Töötunde: ", defrost: "Sulatus: ", additional_heating: "Lisaküte: ",
    flow: "Pealevool ", return: "Tagasivool ", target: "Siht ", temp: "Temp ", water: "Vesi ",
    floor_n: "Põrand ", rad_n: "Radiaator ",
  },
  en: {
    collector: "GROUND LOOP", heatpump: "HEAT PUMP", buffer: "HEATING BUFFER", dhw: "DHW TANK",
    floor: "UNDERFLOOR HEATING", radiators: "RADIATORS", mixer: "MIXING VALVE",
    brine_in: "In ", brine_out: "Out ", outdoor: "Outdoor: ", outdoor_avg: "Outdoor avg: ",
    hot_gas: "Hot gas: ", flow_in_target: "Return target: ", compressor: "Compressor: ", cop: "COP: ",
    capacity: "Capacity: ", hours: "Hours: ", defrost: "Defrost: ", additional_heating: "Aux heater: ",
    flow: "Flow ", return: "Return ", target: "Target ", temp: "Temp ", water: "Water ",
    floor_n: "Floor ", rad_n: "Radiator ",
  },
};

/* Kõik seadistatavad olemid: võti → [domeenid, vaikenimi (või null)] */
const defaults = (p) => ({
  brine_in: `sensor.${p}_heat_source_input_temperature`,
  brine_out: `sensor.${p}_heat_source_output_temperature`,
  brine_pump: `binary_sensor.${p}_brine_pump`,
  status: `sensor.${p}_status`,
  compressor: `binary_sensor.${p}_compressor`,
  outdoor: `sensor.${p}_outdoor_temperature`,
  outdoor_avg: `sensor.${p}_outdoor_temperature_average`,
  hot_gas: `sensor.${p}_hot_gas_temperature`,
  flow_out: `sensor.${p}_flow_out_temperature`,
  flow_in: `sensor.${p}_flow_in_temperature`,
  flow_in_target: `sensor.${p}_flow_in_target_temperature`,
  cop: `sensor.${p}_cop`,
  capacity: `sensor.${p}_heating_capacity`,
  hours: `sensor.${p}_operation_hours`,
  heating_pump: `binary_sensor.${p}_heating_pump`,
  dhw_temp: `sensor.${p}_domestic_water_temperature`,
  dhw_target: `sensor.${p}_domestic_water_target_temperature`,
  dhw_mode: `climate.${p}_domestic_water`,
  dhw_pump: `binary_sensor.${p}_dhw_pump`,
  mix_flow: `sensor.${p}_mixed_circuit_1_flow_out_temperature`,
  mix_target: `sensor.${p}_mixed_circuit_1_flow_out_target_temperature`,
  mix_pump: `binary_sensor.${p}_mixed_circuit_1_pump`,
  heating_mode: `climate.${p}_heating`,
});
// võtmed, millel pole vaikenime (kuvatakse ainult kui kasutaja seadistab)
const NO_DEFAULT = ["buffer_temp", "buffer_target", "defrost", "additional_heating"];
const ALL_KEYS = [...Object.keys(defaults("x")), ...NO_DEFAULT];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

class LuxtronikHeatpumpCard extends HTMLElement {
  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    const c = { ...config, ...(config.entities || {}) }; // vana `entities:` jääb toetatuks
    this._cfg = c;
    this._defaults = defaults(c.prefix || "luxtronik");
    this._floor = this._list(c.floor, 9);
    this._rads = this._list(c.radiators, 3);
    this._extras = this._list(c.extras, 6);
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this._sig = null;
    if (this._hass) this._maybeBuild();
  }

  _list(l, max) { return (l || []).slice(0, max).map((i) => (typeof i === "string" ? { entity: i } : i)).filter((i) => i && i.entity); }

  set hass(h) { this._hass = h; if (this._cfg) { this._maybeBuild(); this._update(); } }
  getCardSize() { return 8; }

  static getConfigElement() { return document.createElement("luxtronik-heatpump-card-editor"); }
  static getStubConfig() { return { prefix: "luxtronik", floor: [], radiators: [] }; }

  _lang() {
    const l = this._cfg.language || (this._hass && this._hass.language) || "et";
    return I18N[String(l).slice(0, 2)] || I18N.en;
  }

  /* Leiab olemi: seadistatud → kasuta; muidu vaikenimi, kui see HA-s olemas; muidu null */
  _ent(key) {
    const c = this._cfg[key];
    if (c === false || c === null || c === "") return null;
    if (c) return c;
    if (this._cfg.auto === false) return null;
    const d = this._defaults[key];
    return d && this._hass.states[d] ? d : null;
  }

  _resolve() {
    const R = {};
    ALL_KEYS.forEach((k) => (R[k] = this._ent(k)));
    return R;
  }

  _maybeBuild() {
    const R = this._resolve();
    const sig = JSON.stringify([R, this._floor, this._rads, this._extras, this._cfg.title, this._cfg.language, this._hass.language,
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
    const mixerOn = show("show_mixer", any("mix_flow", "mix_target", "mix_pump"));
    const floorOn = show("show_floor", this._floor.length > 0 || mixerOn);
    const radOn = show("show_radiators", this._rads.length > 0);
    const bufOn = show("show_buffer", any("buffer_temp", "buffer_target") || floorOn || radOn);
    const dhwOn = show("show_dhw", any("dhw_temp", "dhw_target", "dhw_mode", "dhw_pump"));
    const colOn = show("show_collector", any("brine_in", "brine_out", "brine_pump"));

    const box = (x, y, w, h, c, r = 14, op = 0.1, extra = "") =>
      o.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${c}" fill-opacity="${op}" stroke="${c}" stroke-opacity=".7" stroke-width="2" ${extra}/>`);
    const lbl = (x, y, s, size = 17) => o.push(`<text class="lbl" x="${x}" y="${y}" font-size="${size}">${esc(s)}</text>`);
    const pipe = (d, c, m, w = 6) =>
      o.push(`<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"${m ? ` marker-end="url(#m${m})"` : ""}/>`);
    const val = (x, y, entity, { prefix = "", attr = "", size = 17, bold = false } = {}) => {
      if (!entity) return;
      o.push(`<text class="val${bold ? " b" : ""}" x="${x}" y="${y + 6}" font-size="${size}" data-entity="${esc(entity)}" data-attr="${attr}" data-prefix="${esc(prefix)}">…</text>`);
    };
    const pump = (x, y, entity) => {
      if (!entity) return;
      o.push(`<g class="pump" data-entity="${esc(entity)}" transform="translate(${x},${y})"><circle r="17"/><path d="M-6,-8 L9,0 L-6,8 Z"/></g>`);
    };
    const flow = (entity, paths) => {
      if (!entity || !paths.length) return;
      o.push(`<g class="flow" data-flow="${esc(entity)}" pointer-events="none">${paths.map((d) => `<path d="${d}"/>`).join("")}</g>`);
    };

    o.push(`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><defs>`);
    [["h", HOT], ["c", COLD], ["b", BRINE]].forEach(([n, c]) =>
      o.push(`<marker id="m${n}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`));
    o.push("</defs>");

    /* --- maakollektor --- */
    if (colOn) {
      box(20, 150, 180, 450, GROUND); lbl(110, 180, L.collector);
      pipe("M200,270 H50 V306 H180 V342 H50 V378 H180 V414 H50 V450 H200", GROUND, null, 5);
      pipe("M200,270 H340", BRINE, "b"); pipe("M340,450 H200", COLD, "c");
      flow(R.brine_pump, ["M200,270 H340", "M340,450 H50 V414 H180 V378 H50 V342 H180 V306 H50 V270 H200"]);
      pump(270, 450, R.brine_pump);
      val(270, 245, R.brine_in, { prefix: L.brine_in }); val(270, 492, R.brine_out, { prefix: L.brine_out });
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
        flow(R.heating_pump, ["M540,200 H700", `M700,330 H648 A8,8 0 0 0 632,330 H590 V560`]);
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
      val(620, 160, hpOut, { prefix: L.flow, bold: true }); val(620, 592, hpIn, { prefix: L.return, bold: true });
    }

    /* --- parempoolne osa (nihutatud) --- */
    o.push(`<g transform="translate(${D},0)">`);
    if (bufOn) {
      box(640, 90, 120, 280, HOT, 14, 0.1, R.buffer_temp ? `data-fill="${esc(R.buffer_temp)}"` : "");
      lbl(700, 118, L.buffer, 14);
      val(700, 190, R.buffer_temp, { prefix: L.temp, size: 19, bold: true }); val(700, 232, R.buffer_target, { prefix: L.target });
    }
    if (dhwOn) {
      box(640, 430, 120, 260, HOT, 14, 0.1, R.dhw_temp ? `data-fill="${esc(R.dhw_temp)}"` : "");
      lbl(700, 458, L.dhw, 14);
      val(700, 520, R.dhw_temp, { prefix: L.water, size: 19, bold: true }); val(700, 562, R.dhw_target, { prefix: L.target });
      val(700, 604, R.dhw_mode);
    }
    if (bufOn && (floorOn || radOn)) {
      pipe(`M760,110 H830 V${radOn ? 520 : 160}`, HOT);
      pipe(`M760,340 H800 V${radOn ? 680 : 300}`, COLD);
    }
    if (floorOn) {
      box(940, 40, 340, 360, MIX); lbl(1110, 64, L.floor);
      pipe("M830,160 H940", HOT, "h");
      pipe(radOn ? "M940,300 H838 A8,8 0 0 0 822,300 H800" : "M940,300 H800", COLD, "c");
      pipe("M940,160 H1262 V230 H958 V300 H940", MIX, null, 8);
      if (mixerOn) {
        lbl(885, 140, L.mixer, 14);
        o.push(`<circle cx="905" cy="160" r="18" fill="#222" fill-opacity=".35" stroke="${MIX}" stroke-width="3"/><path d="M893,152 L917,168 M893,168 L917,152" stroke="${MIX}" stroke-width="3"/>`);
        pump(862, 160, R.mix_pump);
        val(885, 205, R.mix_flow, { prefix: L.flow }); val(885, 238, R.mix_target, { prefix: L.target });
        val(885, 271, R.heating_mode);
      }
      flow(R.mix_pump, ["M830,160 H1262 V230 H958 V300 H800"]);
      let n = 0;
      FY.forEach((y) => FX.forEach((cx) => {
        const f = this._floor[n];
        if (f) {
          lbl(cx, y - 32, f.name || L.floor_n + (n + 1), 15);
          val(cx, y - 6, f.entity, { attr: "current_temperature", size: 19, bold: true });
          val(cx, y + 22, f.entity, { attr: "temperature", prefix: "→ ", size: 15 });
        }
        n++;
      }));
    }
    if (radOn) {
      box(940, 470, 340, 255, HOT); lbl(1110, 495, L.radiators);
      pipe("M830,520 H1240", HOT, "h"); pipe("M1240,680 H800", COLD, "c");
      FX.forEach((cx, i) => {
        const r = this._rads[i];
        box(cx - 40, 555, 80, 90, "#888", 8, 0.15);
        for (let k = -24; k <= 24; k += 12)
          o.push(`<line x1="${cx + k}" y1="562" x2="${cx + k}" y2="638" stroke="#999" stroke-opacity=".35" stroke-width="2"/>`);
        pipe(`M${cx},520 V555`, HOT, null, 4); pipe(`M${cx},645 V680`, COLD, null, 4);
        if (r) {
          lbl(cx, 712, r.name || L.rad_n + (i + 1), 15);
          val(cx, 588, r.entity, { attr: "current_temperature", size: 19, bold: true });
          val(cx, 616, r.entity, { attr: "temperature", prefix: "→ ", size: 15 });
        }
      });
    }
    if (bufOn && (floorOn || radOn)) {
      const p = [`M760,110 H830 V${radOn ? 520 : 160}`, `M760,340 H800 V${radOn ? 680 : 300}`];
      if (radOn) p.push("M830,520 H1240", "M1240,680 H800", ...FX.map((x) => `M${x},520 V555`), ...FX.map((x) => `M${x},645 V680`));
      flow(R.heating_pump, p);
    }
    o.push("</g></svg>");
    return o.join("");
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
      </style>
      <ha-card>${this._cfg.title ? `<div class="title">${esc(this._cfg.title)}</div>` : ""}${this._svg()}</ha-card>`;
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
    title: "Pealkiri", prefix: "Olemite eesliide (vaikimisi luxtronik)", language: "Keel", auto: "Leia olemid eesliite järgi automaatselt",
    show_collector: "Näita maakollektorit", show_buffer: "Näita kütte akupaaki", show_dhw: "Näita tarbevee paaki",
    show_floor: "Näita põrandaküttet", show_radiators: "Näita radiaatoreid", show_mixer: "Näita segamissõlme",
    brine_in: "Kollektorisse (sisse) temp", brine_out: "Kollektorist (välja) temp", brine_pump: "Kollektori pump",
    status: "Staatus", compressor: "Kompressor", outdoor: "Välistemperatuur", outdoor_avg: "Välistemp. keskmine", hot_gas: "Kuumgaas",
    flow_out: "Pealevool (soojuspumbalt paakidesse)", flow_in: "Tagasivool (paakidest soojuspumbale)", flow_in_target: "Tagasivoolu siht",
    cop: "COP", capacity: "Soojusvõimsus", hours: "Töötunnid", defrost: "Sulatus", additional_heating: "Lisaküte",
    heating_pump: "Kütte ringluspump", buffer_temp: "Kütte akupaagi temperatuur", buffer_target: "Kütte akupaagi siht",
    dhw_temp: "Tarbevee temperatuur", dhw_target: "Tarbevee siht", dhw_mode: "Tarbevee režiim", dhw_pump: "Tarbevee pump",
    mix_flow: "Segamissõlm: pealevool", mix_target: "Segamissõlm: siht", mix_pump: "Segamisringi pump", heating_mode: "Kütte režiim",
    floor: "Põrandakütte termostaadid (nimed YAML-is)", radiators: "Radiaatorite termostaadid (nimed YAML-is)",
    g_general: "Üldine", g_sections: "Kuvatavad osad", g_hp: "Soojuspump", g_pipe: "Pea- ja tagasivool", g_col: "Maakollektor",
    g_tanks: "Akupaagid", g_mix: "Segamissõlm", g_loads: "Küttekehad",
  },
  en: {
    title: "Title", prefix: "Entity prefix (default luxtronik)", language: "Language", auto: "Auto-detect entities from prefix",
    show_collector: "Show ground loop", show_buffer: "Show heating buffer", show_dhw: "Show DHW tank",
    show_floor: "Show underfloor heating", show_radiators: "Show radiators", show_mixer: "Show mixing valve",
    brine_in: "Ground loop in temp", brine_out: "Ground loop out temp", brine_pump: "Brine pump",
    status: "Status", compressor: "Compressor", outdoor: "Outdoor temperature", outdoor_avg: "Outdoor temp. average", hot_gas: "Hot gas",
    flow_out: "Flow (heat pump → tanks)", flow_in: "Return (tanks → heat pump)", flow_in_target: "Return target",
    cop: "COP", capacity: "Heating capacity", hours: "Operating hours", defrost: "Defrost", additional_heating: "Auxiliary heater",
    heating_pump: "Heating circulation pump", buffer_temp: "Buffer tank temperature", buffer_target: "Buffer tank target",
    dhw_temp: "DHW temperature", dhw_target: "DHW target", dhw_mode: "DHW mode", dhw_pump: "DHW pump",
    mix_flow: "Mixing valve: flow", mix_target: "Mixing valve: target", mix_pump: "Mixing circuit pump", heating_mode: "Heating mode",
    floor: "Underfloor thermostats (names in YAML)", radiators: "Radiator thermostats (names in YAML)",
    g_general: "General", g_sections: "Visible sections", g_hp: "Heat pump", g_pipe: "Flow and return", g_col: "Ground loop",
    g_tanks: "Tanks", g_mix: "Mixing valve", g_loads: "Heat emitters",
  },
};

class LuxtronikHeatpumpCardEditor extends HTMLElement {
  setConfig(config) { this._config = config; this._render(); }
  set hass(h) { this._hass = h; if (this._form) { this._form.hass = h; this._form.computeLabel = this._label(); } }
  _label() {
    const l = (this._hass && this._hass.language) || "et";
    const T = ED_LABELS[String(l).slice(0, 2)] || ED_LABELS.en;
    return (s) => T[s.name] || T[s.title] || s.name;
  }
  _schema() {
    const e = (name, domain) => ({ name, selector: { entity: { domain } } });
    const S = ["sensor"], B = ["binary_sensor", "switch"], CL = ["climate"];
    const grp = (title, schema) => ({ type: "expandable", name: "", title, schema });
    const T = ED_LABELS[String(((this._hass && this._hass.language) || "et")).slice(0, 2)] || ED_LABELS.en;
    return [
      { name: "title", selector: { text: {} } },
      { name: "prefix", selector: { text: {} } },
      { name: "auto", selector: { boolean: {} } },
      { name: "language", selector: { select: { options: [{ value: "et", label: "Eesti" }, { value: "en", label: "English" }], mode: "dropdown" } } },
      grp(T.g_sections, ["show_collector", "show_buffer", "show_dhw", "show_floor", "show_radiators", "show_mixer"].map((n) => ({ name: n, selector: { boolean: {} } }))),
      grp(T.g_col, [e("brine_in", S), e("brine_out", S), e("brine_pump", B)]),
      grp(T.g_pipe, [e("flow_out", S), e("flow_in", S), e("flow_in_target", S), e("heating_pump", B)]),
      grp(T.g_hp, [e("status", S), e("compressor", B), e("outdoor", S), e("outdoor_avg", S), e("hot_gas", S), e("cop", S), e("capacity", S), e("hours", S), e("defrost", B), e("additional_heating", B)]),
      grp(T.g_tanks, [e("buffer_temp", S), e("buffer_target", S), e("dhw_temp", S), e("dhw_target", S), e("dhw_mode", CL), e("dhw_pump", B)]),
      grp(T.g_mix, [e("mix_flow", S), e("mix_target", S), e("mix_pump", B), e("heating_mode", CL)]),
      grp(T.g_loads, [{ name: "floor", selector: { entity: { domain: "climate", multiple: true } } }, { name: "radiators", selector: { entity: { domain: "climate", multiple: true } } }]),
    ];
  }
  _render() {
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        const value = { ...ev.detail.value };
        Object.keys(value).forEach((k) => { if (value[k] === "" || value[k] === undefined) delete value[k]; });
        this._config = value;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: value }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.schema = this._schema();
    this._form.computeLabel = this._label();
    this._form.data = this._config || {};
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
