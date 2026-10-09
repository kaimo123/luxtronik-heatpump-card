# Luxtronik Heatpump Card

Home Assistanti Lovelace kaart maasoojuspumba süsteemi skeemiga. Mõeldud kasutamiseks koos
[BenPru/luxtronik](https://github.com/BenPru/luxtronik) integratsiooniga.

Skeemil on: maakollektor → soojuspump → kütte ja tarbevee akupaak → segamissõlm → põrandaküte
(kuni 9 termostaati) ja radiaatorid (kuni 3 termostaati). Torudel liiguvad täpid ainult siis, kui
vastav ringluspump töötab. Mis tahes väärtusele klõpsates avaneb olemi lisainfo.

## Paigaldus HACS-iga

1. Pane see repo GitHubi (repo nimi: `luxtronik-heatpump-card`).
2. HACS → ⋮ → **Custom repositories** → lisa repo URL, kategooria **Dashboard** (Lovelace).
3. Leia HACS-ist **Luxtronik Heatpump Card** → **Download**.
4. Värskenda brauserit (Ctrl+F5). HACS lisab ressursi automaatselt; vajadusel lisa käsitsi
   *Seaded → Armatuurlauad → ⋮ → Ressursid*: `/hacsfiles/luxtronik-heatpump-card/luxtronik-heatpump-card.js` (JavaScript moodul).

## Seadistus

```yaml
type: custom:luxtronik-heatpump-card
title: Küttesüsteem
prefix: luxtronik          # olemite eesliide (vaikimisi luxtronik)
floor:                     # kuni 9 põrandakütte termostaati
  - entity: climate.pood_1
    name: Elutuba
  - entity: climate.pood_2
    name: Köök
  # ...
radiators:                 # kuni 3 radiaatorit
  - entity: climate.radiaator_1
    name: Magamistuba
  - climate.radiaator_2    # nime võib ära jätta
  - climate.radiaator_3
```

### Valikud

| Valik | Kirjeldus |
|---|---|
| `title` | kaardi pealkiri (valikuline) |
| `prefix` | Luxtroniku olemite eesliide, kui see pole `luxtronik` |
| `language` | `et` või `en` (vaikimisi HA keel, tundmatu keel → inglise) |
| `floor` | põrandakütte termostaadid (`entity` + `name`) |
| `radiators` | radiaatorite termostaadid |
| `entities` | üksikute olemite ülekirjutamine, vt allpool |

### Olemite ülekirjutamine

Vaikimisi tuletatakse nimed eesliitest (`sensor.<prefix>_...`). Kui mõni olem on sinu
paigalduses teise nimega, kirjuta see üle:

```yaml
entities:
  dhw_pump: binary_sensor.minu_tarbevee_pump
  mix_pump: binary_sensor.luxtronik_mixed_circuit_1_pump
```

Saadaolevad võtmed: `brine_in`, `brine_out`, `brine_pump`, `status`, `compressor`, `outdoor`,
`outdoor_avg`, `hot_gas`, `flow_out`, `flow_in`, `flow_in_target`, `cop`, `capacity`, `hours`,
`heating_pump`, `dhw_temp`, `dhw_target`, `dhw_mode`, `dhw_pump`, `mix_flow`, `mix_target`,
`mix_pump`, `heating_mode`.

Animatsioonid: `brine_pump` (kollektor), `heating_pump` (soojuspump ↔ akupaak, magistraaltorud,
radiaatorid), `dhw_pump` (tarbevesi), `mix_pump` (põrandaküte).

Olem, mida ei leita, kuvatakse tuhmina küsimärgiga (`?`).
