<p align="center"><img src="images/icon.svg" width="96" alt="Luxtronik Heatpump Card"></p>

# Luxtronik Heatpump Card

A Home Assistant Lovelace card that draws a live schematic of a ground-source heat pump system, with a
COP / SCOP table underneath.
Built for use with the [BenPru/luxtronik](https://github.com/BenPru/luxtronik) integration, but it works with
any entities you point it at. The structure is inspired by
[lovelace-heat-pump-card](https://github.com/ManfredTremmel/lovelace-heat-pump-card), and the COP / SCOP table by
[cop-scop-card](https://github.com/VitisEK/cop-scop-card).

The schematic follows the water: ground loop → heat pump → one shared flow/return pipe →
heating buffer tank and DHW tank → mixing valve → underfloor heating (**up to 9 thermostats**) and
radiators (**up to 9 TRV-s**).

- **Every sensor is optional.** Whatever you don't configure is not shown. If a whole section has nothing
  configured (e.g. no radiators, no mixing valve), it is left out of the schematic.
- **Heat pump cycle.** The heat pump box (card is 1630 px wide) shows the refrigerant circuit (evaporator, compressor,
  condenser, expansion valve) with the brine side on the left and the heating water on the right. The refrigerant dots
  move while the compressor is on. Status, compressor, COP and capacity appear top-left **only while the compressor
  runs**; hours, defrost, auxiliary heater and extra rows sit at the bottom of the box.
- **Error banner.** A red banner above the heat pump appears only while there is an error, with the error title, cause and
  remedy (see *Error banner*).
- **Animated flow.** Dots move along every pipe only while a pump that actually pushes water through it is on
  (see *Flow animation*). The buffer and DHW tank show their heat pump coil inside the tank.
- **Every readout is optional.** Each value (outdoor temperature, power, pressures, flow rates, ...) appears only
  when you select an entity for it, and the rows in the heat pump box repack when you remove one.
- **Compact thermostat tiles.** Underfloor heating and radiators use the same small tiles, three per row.
  At most 9 per group: once 9 are selected, the editor offers no more entities.
- **Flow-rate and ΔT readouts.** Flow rates are shown next to the pumps only while the pump runs; ΔT (flow − return)
  is shown on the ground loop and the heat pump ↔ tanks circuit only while the matching pumps run (`show_delta: false` hides it).
- **COP / SCOP table** under the schematic, calculated from Home Assistant long-term statistics
  (24 h, 7 days, month, year) with coloured energy-class badges.
- **Thermostat names** are taken from the entities (their friendly name). You can override them.
- **Click any value or pump** to open the entity's more-info dialog.
- **Visual editor** for all options.
- Uses your Home Assistant theme colours (light and dark) and is English/Estonian.

## Installation (HACS)

1. HACS → ⋮ → **Custom repositories** → add this repository's URL, category **Dashboard**.
2. Find **Luxtronik Heatpump Card** and click **Download**.
3. Reload your browser (Ctrl+F5). If the resource wasn't added automatically, add it under
   *Settings → Dashboards → ⋮ → Resources* as a **JavaScript module**:
   `/hacsfiles/luxtronik-heatpump-card/luxtronik-heatpump-card.js`

Manual install: copy `luxtronik-heatpump-card.js` to `/config/www/` and add the resource
`/local/luxtronik-heatpump-card.js?v=2.12.2` as a **JavaScript module**. Raise the `?v=` number after every update
so the browser doesn't use its cached copy.

Then add the card from the card picker (**Luxtronik Heatpump Card**) and configure it in the visual editor,
or use YAML.

## Configuration

Entities are **not detected automatically**. Select (or type) every sensor you want to see.

```yaml
type: custom:luxtronik-heatpump-card
title: Heating system
# Ground loop
brine_in: sensor.luxtronik_heat_source_input_temperature
brine_out: sensor.luxtronik_heat_source_output_temperature
brine_pump: binary_sensor.luxtronik_brine_pump
source_flow_rate: sensor.luxtronik_heat_source_flow_rate
# Heat pump
status: sensor.luxtronik_status
compressor: binary_sensor.luxtronik_compressor
outdoor: sensor.luxtronik_outdoor_temperature
hot_gas: sensor.luxtronik_hot_gas_temperature
power: sensor.luxtronik_heat_pump_power      # shown in W (kW is converted)
low_pressure: sensor.luxtronik_low_pressure   # optional
high_pressure: sensor.luxtronik_high_pressure # optional
superheat: sensor.luxtronik_overheating       # optional, turns red above the target
superheat_target: sensor.luxtronik_overheating_target  # optional, not displayed
defrost_valve: binary_sensor.luxtronik_defrost_valve   # optional
error: binary_sensor.luxtronik_disturbance_output      # on = show the error banner
error_text: sensor.luxtronik_error_reason              # text shown in the banner
cop: sensor.luxtronik_cop
# Shared flow / return pipe
flow_out: sensor.luxtronik_flow_out_temperature
flow_in: sensor.luxtronik_flow_in_temperature
heating_pump: binary_sensor.luxtronik_heating_pump
heat_flow_rate: sensor.luxtronik_heat_amount_flow_rate
# Tanks
buffer_temp: sensor.heating_buffer_temperature
buffer_target: number.heating_buffer_target
dhw_temp: sensor.luxtronik_domestic_water_temperature
dhw_target: number.luxtronik_domestic_water_target_temperature
dhw_mode: select.luxtronik_domestic_water_mode
dhw_pump: binary_sensor.luxtronik_dhw_pump
# Mixing valve
mix_flow: sensor.luxtronik_mixed_circuit_1_flow_out_temperature
mix_target: number.luxtronik_mixed_circuit_1_target_temperature
mix_return: sensor.luxtronik_mixed_circuit_1_return_temperature
mix_pump: binary_sensor.luxtronik_mixed_circuit_1_pump
heating_mode: select.luxtronik_heating_mode
# Thermostats (names come from the entities unless you set `name`)
floor:
  - climate.floor_living_room
  - entity: climate.floor_kitchen
    name: Kitchen
radiators:
  - climate.radiator_bedroom
# COP / SCOP table (optional)
cop_heating_produced: sensor.luxtronik_heat_amount_heating
cop_heating_consumed: sensor.luxtronik_heating_energy_input
cop_dhw_produced: sensor.luxtronik_heat_amount_domestic_water
cop_dhw_consumed: sensor.luxtronik_domestic_water_energy_input
cop_heat_correction: 0.55   # optional: correct a heat meter that over-reads (default 1)
```

> The entity IDs above are examples. Check yours under *Developer tools → States*.

### General options

| Option | Description |
|---|---|
| `title` | Card title (optional) |
| `language` | `et` or `en` (default: your Home Assistant language, English as fallback) |
| `show_collector`, `show_buffer`, `show_dhw`, `show_floor`, `show_radiators`, `show_mixer` | Force a section on (`true`) or off (`false`). By default a section is shown when something is configured for it |
| `show_cop` | Set to `false` to hide the COP / SCOP table. By default it is shown when COP sensors are configured |
| `show_delta` | Set to `false` to hide the ΔT readouts (default `true`) |
| `show_error` | Set to `false` to never show the error banner (default `true`) |
| `floor` | Underfloor heating thermostats, **max 9**. Each item is an entity ID or `{entity, name}` |
| `radiators` | Radiator thermostats, **max 9**. Same format |
| `extras` | Up to 6 extra rows in the heat pump box, each `{entity, name}` |

### Sensor options

| Key | Description | Entity type | Animation |
|---|---|---|---|
| `brine_in`, `brine_out` | Ground loop temperature in / out | sensor | |
| `brine_pump` | Ground loop (brine) pump | binary_sensor / switch | ground loop |
| `source_flow_rate` | Heat source (brine) flow rate, shown at the brine pump **only while it runs** | sensor | |
| `status`, `compressor` | Heat pump status, compressor. The compressor icon turns green and the refrigerant dots move while it is on | sensor / binary_sensor | refrigerant circuit |
| `outdoor`, `outdoor_avg` | Outdoor temperature, average (shown above the ground loop) | sensor | |
| `hot_gas` | Hot gas temperature (on the compressor outlet line) | sensor | |
| `power` | Heat pump power consumption, always shown in **W** (kW and MW sensors are converted). Shown at the compressor | sensor | |
| `error` | Binary sensor: `on` shows the red error banner above the heat pump (hidden otherwise) | binary_sensor / switch | |
| `error_text` | Text sensor with the error message (e.g. Luxtronik *Error reason*). Without `error`, the banner shows whenever this state is not "normal" | any | |
| `error_ignore` | Comma-separated text states to treat as "no error" (only used when `error` is not set) | text | |
| `low_pressure`, `high_pressure` | Low / high refrigerant pressure (optional) | sensor | |
| `superheat` | Superheat, shown under the expansion valve. Turns red (bold) when above the target / limit | sensor | |
| `superheat_target` | Superheat target. **Not displayed**; used as the red threshold (a target above 25 K while the value is below 25 K is treated as 10× scaled, as Luxtronik reports it) | sensor | |
| `superheat_limit` | Optional fixed red threshold in K, used instead of `superheat_target` | number | |
| `defrost_valve` | Defrost valve: a hot-gas bypass drawn in the centre of the heat pump; orange and animated while open | binary_sensor | |
| `flow_out` | Flow temperature (shown on the shared pipe) | sensor | |
| `flow_in` | Return temperature (shown on the shared pipe) | sensor | |
| `flow_in_target` | Return target temperature | sensor | |
| `cop`, `capacity`, `hours` | COP, heating capacity, operating hours | sensor | |
| `defrost`, `additional_heating` | Defrost, auxiliary heater | binary_sensor / switch | |
| `heating_pump` | Heating circulation pump | binary_sensor / switch | heat pump ↔ buffer tank, radiators, trunk pipes |
| `heat_flow_rate` | Heat amount flow rate. Shown at the DHW pump while hot water is being made, otherwise at the heating pump while it runs | sensor | |
| `buffer_temp` | Heating buffer tank temperature | sensor | |
| `buffer_target` | Heating buffer tank target | number / input_number | |
| `dhw_temp` | DHW temperature | sensor | |
| `dhw_target` | DHW target | number / input_number | |
| `dhw_mode` | DHW mode | select / input_select | |
| `dhw_pump` | DHW pump | binary_sensor / switch | DHW branch |
| `mix_flow`, `mix_return` | Mixing valve flow and underfloor return temperature | sensor | |
| `mix_target` | Mixing valve target | number / input_number | |
| `mix_pump` | Mixing circuit pump | binary_sensor / switch | underfloor heating |
| `heating_mode` | Heating mode | select / input_select | |
| `rad_flow`, `rad_return` | Radiator circuit flow and return temperature | sensor | |
| `rad_pump` | Radiator circuit pump | binary_sensor / switch | radiator circuit |

The heating buffer is shaded like a stratified tank (red at the top, blue at the bottom); the DHW tank's colour follows
its temperature (blue at 20 °C → red at 60 °C) when `dhw_temp` is set.
If an entity is configured but does not exist, its value is shown dimmed as `?` so you can spot typos.

Targets and modes are written as before in older configurations: a `climate` or `sensor` entity still displays its
state, only the visual editor now offers `number` / `select` entities. The heating / DHW mode text is hidden while the
mode is "Automatic" (other modes are shown).

## Flow animation

Every pipe segment is drawn once and animates when **at least one** pump that circulates water through it is on.
Shared pipes therefore never show doubled dots, and each situation looks right:

| Pump on | Animated pipes |
|---|---|
| `brine_pump` | the whole ground-loop circuit through the evaporator |
| `heating_pump` | heat pump ↔ heating buffer (shared flow/return trunk, condenser coil, coil inside the buffer) |
| `dhw_pump` | heat pump ↔ DHW tank (shared trunk, DHW branch, coil inside the DHW tank) |
| `mix_pump` | buffer outlet → mixing valve → underfloor loop → return to the buffer |
| `rad_pump` | buffer outlet → supply trunk → radiators → return to the buffer |
| `compressor` | refrigerant circuit (evaporator → compressor → condenser → expansion valve) |
| `defrost_valve` | hot-gas bypass from the compressor outlet to the evaporator (orange while open) |

The shared trunk between the heat pump and the tanks moves when either the heating or the DHW pump runs; the buffer
outlet and the return into the buffer move when either the mixing or the radiator circuit runs. If `mix_pump` /
`rad_pump` are not configured, the `heating_pump` drives the matching load circuit instead.

While the `dhw_pump` runs, the heating-buffer branch (its flow, return and coil) stands still, like a diverter valve
that sends all water to the DHW tank.

## Error banner

Set `error` to a binary sensor (e.g. Luxtronik *Disturbance output*): while it is `on`, a red, pulsing banner appears
above the heat pump; otherwise nothing is shown. Set `error_text` to the text sensor that carries the message (e.g.
*Error reason*). The banner shows the title, the cause and the remedy of the error. The Home Assistant translated state is
used first; the card also embeds the Luxtronik error-code table from BenPru/luxtronik (89 codes, English) as a fallback
when only the numeric code is available. With only `error_text` set, the banner shows whenever its state is not "none /
ok / unknown / …" (extend the list with `error_ignore`).

## COP / SCOP table

A table under the schematic with rows **Heating**, **Hot water** and **Total** and columns **24 h (COP)**, **7 days (COP)**,
**Month (COP)** and **Year (SCOP)**. Rows can be switched off one by one. Each cell shows the COP, the heat produced and electricity consumed (kWh) and,
optionally, a coloured energy-class badge (A+++ green … G red).

The values come from Home Assistant **long-term statistics**, so the sensors must be energy counters with a
`state_class` (`total_increasing` or `total`). Without a state class Home Assistant records no statistics and the
cell stays empty. Units (Wh, kWh, MWh) are converted to kWh automatically.

**Calculation**

```
COP = heat produced / (electricity consumed + auxiliary heater)
```

- Heat, electricity and auxiliary energy are summed only over the hours/days where **both** the heat and the
  electricity sensor have data. A sensor with a shorter history (for example, electricity recorded for 30 days but
  heat for a year) therefore does not distort the result.
- **Total** is heating + hot water, unless you configure `cop_total_*` sensors.
- 7 days, month and year use whole days counted from local midnight, today included; 24 h is the last 24 hours.
- Statistics are fetched at most once per `cop_refresh_minutes` (default 60), not on every sensor update.

**Energy class** is an estimate: ηs ≈ COP / 2.5 − 3 %, thresholds from EU Regulation 811/2013 for heat-pump space
heaters. The same scale is used in every cell, including hot water and short periods, so treat it as a guide. The
official class depends on the product data sheet.

| Option | Description |
|---|---|
| `cop_heating_produced`, `cop_heating_consumed`, `cop_heating_aux`, `cop_heating_aux2`, `cop_heating_name` | Heating row: heat produced, electricity consumed, up to two auxiliary heater sensors, optional name |
| `cop_dhw_produced`, `cop_dhw_consumed`, `cop_dhw_aux`, `cop_dhw_aux2`, `cop_dhw_name` | Hot water row, same options |
| `cop_total_produced`, `cop_total_consumed`, `cop_total_aux`, `cop_total_aux2`, `cop_total_name` | Total row (optional, otherwise heating + hot water) |
| `cop_show_heating`, `cop_show_dhw`, `cop_show_total` | Set a row to `false` to remove it from the table (default `true`) |
| `cop_aux_included` | `true` if the consumed sensors already include the auxiliary heater (default `false`: aux is added) |
| `cop_heat_correction` | Factor applied to produced heat before COP/SCOP (default `1`). Use e.g. `0.55` when the heat meter over-reads by ~1.8x |
| `cop_show_classes` | Coloured energy-class badges (default `true`) |
| `cop_class_mode` | `eu_low` (low-temperature, ≤ 35 °C, default) or `eu_medium` (55 °C) |
| `cop_show_energy` | Show heat / electricity kWh under the COP (default `true`) |
| `cop_month_days`, `cop_year_days` | Length of the month and year columns in days (default 30 and 365) |
| `cop_refresh_minutes` | How often the statistics are refreshed (default 60) |
| `show_cop` | Hide the whole table with `false` |

## Changelog

- **2.12.2** Roomier bottom of the heat pump: superheat centred under the expansion valve, low/high pressure on their own row.
- **2.12.1** The superheat target is no longer displayed; the superheat value turns red when it exceeds the target (or the optional `superheat_limit`). A target above 25 while the value is below 25 is treated as 10x scaled.
- **2.12.0** New optional entities `superheat` / `superheat_target` (shown under the expansion valve) and `defrost_valve` (binary sensor): a defrost bypass valve between the compressor outlet and the evaporator that turns orange with moving dots while it is open.
- **2.11.1** The error banner is wider and shows the full title, cause and remedy on several lines (no truncation, no tooltip needed).
- **2.11.0** The error banner embeds the Luxtronik error-code table (from BenPru/luxtronik translations): title, cause and (as a tooltip) remedy. Home Assistant's translated state is used first; the table is the fallback when it only returns the code.
