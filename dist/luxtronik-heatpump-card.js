/*!
 * Luxtronik Heatpump Card
 * Skeemikaart maasoojuspumba süsteemile (Home Assistant + BenPru/luxtronik)
 */
const LHC_VERSION = "1.0.0";
const W = 1300, H = 740;
const HOT = "#e5533d", COLD = "#3d8be5", BRINE = "#4fb3d9", MIX = "#f0a030", GROUND = "#a98467";

const I18N = {
  et: {
    collector: "MAAKOLLEKTOR", heatpump: "SOOJUSPUMP", buffer: "KÜTTE AKUPAAK", dhw: "TARBEVEE AKUPAAK",
    floor: "PÕRANDAKÜTE", radiators: "RADIAATORID", mixer: "SEGAMISSÕLM",
    brine_in: "Sisse ", brine_out: "Välja ", outdoor: "Väljas: ", outdoor_avg: "Väljas keskm.: ",
    hot_gas: "Kuumgaas: ", flow_out: "Pealevool: ", flow_in: "Tagasivool: ", flow_in_target: "Tagasiv. siht: ",
    compressor: "Kompressor: ", cop: "COP: ", capacity: "Võimsus: ", hours: "Töötunde: ",
    flow: "Pealevool ", return: "Tagasivool ", target: "Siht ", water: "Vesi ",
    floor_n: "Põrand ", rad_n: "Radiaator ",
  },
  en: {
    collector: "GROUND LOOP", heatpump: "HEAT PUMP", buffer: "HEATING BUFFER", dhw: "DHW TANK",
    floor: "UNDERFLOOR HEATING", radiators: "RADIATORS", mixer: "MIXING VALVE",
    brine_in: "In ", brine_out: "Out ", outdoor: "Outdoor: ", outdoor_avg: "Outdoor avg: ",
    hot_gas: "Hot gas: ", flow_out: "Flow: ", flow_in: "Return: ", flow_in_target: "Return target: ",
    compressor: "Compressor: ", cop: "COP: ", capacity: "Capacity: ", hours: "Hours: ",
    flow: "Flow ", return: "Return ", target: "Target ", water: "Water ",
    floor_n: "Floor ", rad_n: "Radiator ",
  },
};

const defaultEntities = (p) => ({
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

const FLOWS = {
  brine: ["brine_pump", ["M200,270 H340", "M340,450 H50 V414 H180 V378 H50 V342 H180 V306 H50 V270 H200"]],
  heating: ["heating_pump", [
    "M540,200 H640", "M640,330 H540", "M760,110 H830 V520 H1240", "M1240,680 H800 V340 H760",
    ...[1005, 1110, 1215].map((x) => `M${x},520 V555`), ...[1005, 1110, 1215].map((x) => `M${x},645 V680`)]],
  dhw: ["dhw_pump", ["M540,480 H640", "M640,560 H540"]],
  floor: ["mix_pump", ["M830,160 H1262 V230 H958 V300 H800"]],
};

const FX = [1005, 1110, 1215], FY = [125, 225, 325];

class LuxtronikHeatpumpCard extends HTMLElement {
  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    const prefix = config.prefix || "luxtronik";
    this._config = {
      title: config.title,
      language: config.language,
      floor: config.floor || [],
      radiators: config.radiators || [],
      entities: { ...defaultEntities(prefix), ...(config.entities || {}) },
    };
    this._config.floor = this._normList(this._config.floor, 9);
    this._config.radiators = this._normList(this._config.radiators, 3);
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this._built = false;
    this._build();
    if (this._hass) this._update();
  }

  _normList(list, max) {
    return list.slice(0, max).map((it) => (typeof it === "string" ? { entity: it } : it));
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) this._build();
    this._update();
  }

  getCardSize() { return 8; }

  static getStubConfig() {
    return {
      prefix: "luxtronik",
      floor: Array.from({ length: 9 }, (_, i) => ({ entity: `climate.floor_${i + 1}`, name: `Floor ${i + 1}` })),
      radiators: Array.from({ length: 3 }, (_, i) => ({ entity: `climate.radiator_${i + 1}`, name: `Radiator ${i + 1}` })),
    };
  }

  _lang() {
    const l = this._config.language || (this._hass && this._hass.language) || "et";
    return I18N[String(l).slice(0, 2)] || I18N.en;
  }

  /* ---------- SVG ---------- */
  _svg() {
    const L = this._lang(), E = this._config.entities, o = [];
    const box = (x, y, w, h, c, r = 14, op = 0.1) =>
      o.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${c}" fill-opacity="${op}" stroke="${c}" stroke-opacity=".7" stroke-width="2"/>`);
    const lbl = (x, y, s, size = 17) => o.push(`<text class="lbl" x="${x}" y="${y}" font-size="${size}">${s}</text>`);
    const pipe = (d, c, m, w = 6) =>
      o.push(`<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"${m ? ` marker-end="url(#m${m})"` : ""}/>`);
    const val = (x, y, entity, { prefix = "", attr = "", size = 17, bold = false } = {}) =>
      o.push(`<text class="val${bold ? " b" : ""}" x="${x}" y="${y + 6}" font-size="${size}" data-entity="${entity || ""}" data-attr="${attr}" data-prefix="${prefix}">…</text>`);
    const pump = (x, y, key) =>
      o.push(`<g class="pump" data-entity="${E[key]}" transform="translate(${x},${y})"><circle r="17"/><path d="M-6,-8 L9,0 L-6,8 Z"/></g>`);

    o.push(`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><defs>`);
    [["h", HOT], ["c", COLD], ["b", BRINE]].forEach(([n, c]) =>
      o.push(`<marker id="m${n}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`));
    o.push("</defs>");

    box(20, 150, 180, 450, GROUND); box(340, 150, 200, 450, "#888");
    box(640, 90, 120, 280, HOT); box(640, 430, 120, 260, HOT);
    box(940, 40, 340, 360, MIX); box(940, 470, 340, 255, HOT);
    lbl(110, 180, L.collector); lbl(440, 178, L.heatpump);
    lbl(700, 118, L.buffer, 14); lbl(700, 458, L.dhw, 14);
    lbl(1110, 64, L.floor); lbl(1110, 495, L.radiators); lbl(885, 140, L.mixer, 14);

    pipe("M200,270 H50 V306 H180 V342 H50 V378 H180 V414 H50 V450 H200", GROUND, null, 5);
    pipe("M200,270 H340", BRINE, "b"); pipe("M340,450 H200", COLD, "c");
    pipe("M540,200 H640", HOT, "h"); pipe("M640,330 H540", COLD, "c");
    pipe("M540,480 H640", HOT, "h"); pipe("M640,560 H540", COLD, "c");
    pipe("M760,110 H830 V520", HOT); pipe("M760,340 H800 V680", COLD);
    pipe("M830,160 H940", HOT, "h"); pipe("M940,300 H800", COLD, "c");
    pipe("M940,160 H1262 V230 H958 V300 H940", MIX, null, 8);
    pipe("M830,520 H1240", HOT, "h"); pipe("M1240,680 H800", COLD, "c");
    o.push(`<circle cx="905" cy="160" r="18" fill="#222" fill-opacity=".35" stroke="${MIX}" stroke-width="3"/><path d="M893,152 L917,168 M893,168 L917,152" stroke="${MIX}" stroke-width="3"/>`);

    /* flow animation overlays */
    Object.entries(FLOWS).forEach(([name, [key, paths]]) => {
      o.push(`<g class="flow" data-flow="${E[key]}">${paths.map((d) => `<path d="${d}"/>`).join("")}</g>`);
    });

    pump(270, 450, "brine_pump"); pump(590, 200, "heating_pump"); pump(590, 480, "dhw_pump"); pump(862, 160, "mix_pump");

    /* radiators */
    FX.forEach((cx, i) => {
      box(cx - 40, 555, 80, 90, "#888", 8, 0.15);
      for (let k = -24; k <= 24; k += 12)
        o.push(`<line x1="${cx + k}" y1="562" x2="${cx + k}" y2="638" stroke="#999" stroke-opacity=".35" stroke-width="2"/>`);
      pipe(`M${cx},520 V555`, HOT, null, 4); pipe(`M${cx},645 V680`, COLD, null, 4);
      const r = this._config.radiators[i];
      lbl(cx, 712, (r && r.name) || L.rad_n + (i + 1), 15);
      if (r) {
        val(cx, 588, r.entity, { attr: "current_temperature", size: 19, bold: true });
        val(cx, 616, r.entity, { attr: "temperature", prefix: "→ ", size: 15 });
      }
    });
    /* floor thermostats */
    let n = 0;
    FY.forEach((y) => FX.forEach((cx) => {
      const f = this._config.floor[n];
      lbl(cx, y - 32, (f && f.name) || L.floor_n + (n + 1), 15);
      if (f) {
        val(cx, y - 6, f.entity, { attr: "current_temperature", size: 19, bold: true });
        val(cx, y + 22, f.entity, { attr: "temperature", prefix: "→ ", size: 15 });
      }
      n++;
    }));

    /* sensors */
    val(270, 245, E.brine_in, { prefix: L.brine_in }); val(270, 492, E.brine_out, { prefix: L.brine_out });
    [[208, "status", "", true], [243, "compressor"], [283, "outdoor"], [317, "outdoor_avg"], [353, "hot_gas"],
     [389, "flow_out"], [423, "flow_in"], [457, "flow_in_target"], [501, "cop", "", true], [535, "capacity"], [569, "hours"]]
      .forEach(([y, k, , b]) => val(440, y, E[k], { prefix: k === "status" ? "" : L[k], bold: !!b }));
    val(700, 190, E.flow_in, { prefix: L.return }); val(700, 232, E.flow_in_target, { prefix: L.target });
    val(700, 520, E.dhw_temp, { prefix: L.water, size: 19, bold: true }); val(700, 562, E.dhw_target, { prefix: L.target });
    val(700, 604, E.dhw_mode);
    val(885, 205, E.mix_flow, { prefix: L.flow }); val(885, 238, E.mix_target, { prefix: L.target });
    val(885, 271, E.heating_mode);
    o.push("</svg>");
    return o.join("");
  }

  _build() {
    if (!this._config || !this.shadowRoot) return;
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
        .pump circle{fill:var(--card-background-color);stroke:var(--secondary-text-color);stroke-width:2}
        .pump path{fill:var(--secondary-text-color)}
        .pump.on circle{stroke:var(--success-color,#4caf50);fill:var(--success-color,#4caf50);fill-opacity:.25}
        .pump.on path{fill:var(--success-color,#4caf50)}
        .pump{cursor:pointer}
        .flow{display:none}
        .flow.on{display:inline}
        .flow path{fill:none;stroke:#fff;stroke-opacity:.9;stroke-width:3;stroke-linecap:round;
                   stroke-dasharray:2 18;animation:m 1.2s linear infinite}
        @keyframes m{from{stroke-dashoffset:0}to{stroke-dashoffset:-20}}
      </style>
      <ha-card>${this._config.title ? `<div class="title">${this._config.title}</div>` : ""}${this._svg()}</ha-card>`;
    this.shadowRoot.querySelectorAll("[data-entity]").forEach((el) => {
      const id = el.getAttribute("data-entity");
      if (!id) return;
      el.addEventListener("click", () =>
        this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true })));
    });
    this._built = true;
  }

  _fmt(id, attr) {
    const s = this._hass.states[id];
    if (!s) return null;
    const unit = this._hass.config?.unit_system?.temperature || "°C";
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
    if (!this._hass || !this.shadowRoot) return;
    const st = this._hass.states;
    this.shadowRoot.querySelectorAll("text.val").forEach((el) => {
      const id = el.getAttribute("data-entity");
      const f = id ? this._fmt(id, el.getAttribute("data-attr")) : null;
      el.classList.toggle("missing", f === null);
      el.textContent = f === null ? "?" : el.getAttribute("data-prefix") + f;
      const s = st[id];
      el.classList.toggle("heating", !!(s && s.attributes.hvac_action === "heating" && el.getAttribute("data-attr") === "current_temperature"));
    });
    this.shadowRoot.querySelectorAll("g.pump").forEach((el) => {
      const s = st[el.getAttribute("data-entity")];
      el.classList.toggle("on", !!s && s.state === "on");
    });
    this.shadowRoot.querySelectorAll("g.flow").forEach((el) => {
      const s = st[el.getAttribute("data-flow")];
      el.classList.toggle("on", !!s && s.state === "on");
    });
  }
}

customElements.define("luxtronik-heatpump-card", LuxtronikHeatpumpCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "luxtronik-heatpump-card",
  name: "Luxtronik Heatpump Card",
  description: "Maasoojuspumba skeem animeeritud vooluga (Luxtronik integratsioon)",
  preview: false,
});
console.info(`%c LUXTRONIK-HEATPUMP-CARD %c v${LHC_VERSION} `, "color:white;background:#e5533d;font-weight:700", "color:#e5533d");
