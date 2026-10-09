# Luxtronik Heatpump Card

Home Assistanti Lovelace kaart maasoojuspumba süsteemi skeemiga. Mõeldud kasutamiseks koos
[BenPru/luxtronik](https://github.com/BenPru/luxtronik) integratsiooniga. Ülesehituselt inspireeritud
kaardist [lovelace-heat-pump-card](https://github.com/ManfredTremmel/lovelace-heat-pump-card).

Skeem: maakollektor → soojuspump → **üks ühine pea- ja tagasivoolutoru** → kütte akupaak ja tarbevee akupaak →
segamissõlm → põrandaküte (kuni 9 termostaati) ja radiaatorid (kuni 3 termostaati).
Torudel liiguvad täpid ainult siis, kui vastav ringluspump töötab. Väärtusele klõpsates avaneb olemi lisainfo.

**Iga andur on valikuline.** Mida pole seadistatud ega leita, seda kaardil ei kuvata. Kui terve osa
(näiteks radiaatorid või segamissõlm) on tühi, jäetakse see skeemilt välja.

## Paigaldus HACS-iga

1. Lisa repo: HACS → ⋮ → **Custom repositories** → URL + kategooria **Dashboard**.
2. Leia **Luxtronik Heatpump Card** → **Download**.
3. Värskenda brauserit (Ctrl+F5). Vajadusel lisa ressurss käsitsi:
   `/hacsfiles/luxtronik-heatpump-card/luxtronik-heatpump-card.js` (JavaScript moodul).

Kaart on lisamisel valitav kaartide nimekirjast ja seda saab seadistada **visuaalse redaktoriga**.

## Kuidas olemid leitakse

Iga võtme jaoks toimub järgmine:
1. Kui võti on seadistatud (nt `dhw_pump: binary_sensor.minu_pump`), kasutatakse seda.
2. Muidu proovitakse Luxtroniku vaikenime (`sensor.<prefix>_...`). Kui see HA-s olemas on, kasutatakse seda.
3. Muidu andurit ei kuvata.

`auto: false` lülitab vaikenimede otsimise välja (kuvatakse ainult see, mis on seadistatud).
`brine_in: false` jätab konkreetse anduri sundkorras välja.

## Näide

```yaml
type: custom:luxtronik-heatpump-card
title: Küttesüsteem
prefix: luxtronik
buffer_temp: sensor.kutte_akupaak_temp      # Luxtroniku vaikimisi pole, ainult kui andur on olemas
floor:
  - entity: climate.pood_1
    name: Elutuba
  - climate.pood_2
radiators:
  - entity: climate.radiaator_1
    name: Magamistuba
extras:                                      # lisaread soojuspumba kasti
  - entity: sensor.minu_lisaandur
    name: Kompressori sagedus
```

## Valikud

| Valik | Kirjeldus |
|---|---|
| `title` | pealkiri |
| `prefix` | Luxtroniku olemite eesliide (vaikimisi `luxtronik`) |
| `auto` | `false` = ära otsi vaikenimesid |
| `language` | `et` või `en` |
| `show_collector`, `show_buffer`, `show_dhw`, `show_floor`, `show_radiators`, `show_mixer` | osa sunnitud sisse (`true`) või välja (`false`); vaikimisi kuvatakse osa siis, kui selle andureid leidub |
| `floor` | põrandakütte termostaadid (`entity` + valikuline `name`), kuni 9 |
| `radiators` | radiaatorite termostaadid, kuni 3 |
| `extras` | lisaandurid soojuspumba kasti (`entity` + valikuline `name`), kuni 6 |

### Andurid

| Võti | Mis see on | Vaikenimi |
|---|---|---|
| `brine_in` / `brine_out` | kollektorisse / kollektorist temp | `sensor.<p>_heat_source_input/output_temperature` |
| `brine_pump` | kollektori pump (animatsioon) | `binary_sensor.<p>_brine_pump` |
| `status`, `compressor` | staatus, kompressor | `sensor.<p>_status`, `binary_sensor.<p>_compressor` |
| `outdoor`, `outdoor_avg` | välistemperatuur, keskmine | `sensor.<p>_outdoor_temperature[_average]` |
| `hot_gas` | kuumgaas | `sensor.<p>_hot_gas_temperature` |
| `flow_out` | **pealevool** (ühine toru) | `sensor.<p>_flow_out_temperature` |
| `flow_in` | **tagasivool** (ühine toru) | `sensor.<p>_flow_in_temperature` |
| `flow_in_target` | tagasivoolu siht | `sensor.<p>_flow_in_target_temperature` |
| `cop`, `capacity`, `hours` | COP, võimsus, töötunnid | `sensor.<p>_cop`, `_heating_capacity`, `_operation_hours` |
| `defrost`, `additional_heating` | sulatus, lisaküte | – (ainult kui seadistad) |
| `heating_pump` | kütte ringluspump (animatsioon) | `binary_sensor.<p>_heating_pump` |
| `buffer_temp`, `buffer_target` | kütte akupaagi temp, siht | – (ainult kui seadistad) |
| `dhw_temp`, `dhw_target`, `dhw_mode` | tarbevesi | `sensor.<p>_domestic_water_[target_]temperature`, `climate.<p>_domestic_water` |
| `dhw_pump` | tarbevee pump (animatsioon) | `binary_sensor.<p>_dhw_pump` |
| `mix_flow`, `mix_target`, `mix_pump` | segamissõlm | `sensor.<p>_mixed_circuit_1_flow_out[_target]_temperature`, `binary_sensor.<p>_mixed_circuit_1_pump` |
| `heating_mode` | kütte režiim | `climate.<p>_heating` |

Akupaagi (`buffer_temp`, `dhw_temp`) värv muutub temperatuuri järgi: 20 °C sinine → 60 °C punane.

Animatsioonid: `brine_pump` (kollektor), `heating_pump` (soojuspump ↔ kütte akupaak ja küttekehad),
`dhw_pump` (tarbevee haru), `mix_pump` (põrandaküte).
