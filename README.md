# Luxtronik Heatpump Card

A Home Assistant Lovelace card that draws a live schematic of a ground-source heat pump system.
Built for use with the [BenPru/luxtronik](https://github.com/BenPru/luxtronik) integration, but it works with
any entities you point it at. The structure is inspired by
[lovelace-heat-pump-card](https://github.com/ManfredTremmel/lovelace-heat-pump-card).

The schematic follows the water: ground loop → heat pump → **one shared flow/return pipe** →
heating buffer tank and DHW tank → mixing valve → underfloor heating (up to **9 zones**) and
radiators (up to ).

The schematic follows the water: ground loop → heat pump → one shared flow/return pipe → 
heating buffer tank and DHW tank → mixing valve → underfloor heating (**9 thermostats**) and 
radiators (**up to 9 TRV-s**).

- **Every sensor is optional.** Whatever you don't configure is not shown. If a whole section has nothing
  configured (e.g. no radiators, no mixing valve), it is left out of the schematic.
- **Animated flow.** Dots move along the pipes only while the matching circulation pump is on.
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
# Heat pump
status: sensor.luxtronik_status
compressor: binary_sensor.luxtronik_compressor
outdoor: sensor.luxtronik_outdoor_temperature
hot_gas: sensor.luxtronik_hot_gas_temperature
cop: sensor.luxtronik_cop
# Shared flow / return pipe
flow_out: sensor.luxtronik_flow_out_temperature
flow_in: sensor.luxtronik_flow_in_temperature
heating_pump: binary_sensor.luxtronik_heating_pump
# Tanks
buffer_temp: sensor.heating_buffer_temperature
dhw_temp: sensor.luxtronik_domestic_water_temperature
dhw_target: sensor.luxtronik_domestic_water_target_temperature
dhw_pump: binary_sensor.luxtronik_dhw_pump
# Mixing valve
mix_flow: sensor.luxtronik_mixed_circuit_1_flow_out_temperature
mix_pump: binary_sensor.luxtronik_mixed_circuit_1_pump
# Thermostats (names come from the entities unless you set `name`)
floor:
  - climate.floor_living_room
  - entity: climate.floor_kitchen
    name: Kitchen
radiators:
  - climate.radiator_bedroom
```

> The entity IDs above are examples. Check yours under *Developer tools → States*.

### General options

| Option | Description |
|---|---|
| `title` | Card title (optional) |
| `language` | `et` or `en` (default: your Home Assistant language, English as fallback) |
| `show_collector`, `show_buffer`, `show_dhw`, `show_floor`, `show_radiators`, `show_mixer` | Force a section on (`true`) or off (`false`). By default a section is shown when something is configured for it |
| `floor` | Underfloor heating thermostats, up to 9. Each item is an entity ID or `{entity, name}` |
| `radiators` | Radiator thermostats, up to 9. Same format |
| `extras` | Up to 6 extra rows in the heat pump box, each `{entity, name}` |

### Sensor options

| Key | Description | Animation |
|---|---|---|
| `brine_in`, `brine_out` | Ground loop temperature in / out | |
| `brine_pump` | Ground loop (brine) pump | ground loop |
| `status`, `compressor` | Heat pump status, compressor | |
| `outdoor`, `outdoor_avg` | Outdoor temperature, average | |
| `hot_gas` | Hot gas temperature | |
| `flow_out` | Flow temperature (shown on the shared pipe) | |
| `flow_in` | Return temperature (shown on the shared pipe) | |
| `flow_in_target` | Return target temperature | |
| `cop`, `capacity`, `hours` | COP, heating capacity, operating hours | |
| `defrost`, `additional_heating` | Defrost, auxiliary heater | |
| `heating_pump` | Heating circulation pump | heat pump ↔ buffer tank, radiators, trunk pipes |
| `buffer_temp`, `buffer_target` | Heating buffer tank temperature and target | |
| `dhw_temp`, `dhw_target`, `dhw_mode` | DHW temperature, target, mode | |
| `dhw_pump` | DHW pump | DHW branch |
| `mix_flow`, `mix_target`, `mix_pump` | Mixing valve flow, target, pump | underfloor heating |
| `heating_mode` | Heating mode (climate entity) | |

A tank's colour follows its temperature (blue at 20 °C → red at 60 °C) when `buffer_temp` / `dhw_temp` is set.
If an entity is configured but does not exist, its value is shown dimmed as `?` so you can spot typos.

## Changelog

### 2.1.0
- Removed entity auto-detection and the `prefix` option. Only configured entities are shown.
- Underfloor heating and radiators now both support 9 thermostats (3 × 3 grids).
- Thermostat names default to the entity's friendly name.
- Fixed the return-flow animation: dots now travel from the radiators / floor circuit back to the buffer tank.
- Smaller pipe arrowheads; buffer tank title no longer collides with its flow pipe.
