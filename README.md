# Vem av oss? – bröllopslek för Oliver & Tilda

En festlig scenvisning för en ”vem av oss”-lek. Toastmastern läser upp påståenden,
gästerna pekar på den de tror att det gäller, och sedan avslöjas svaret på skärmen.

## Sidor

| Sida | Till vad |
| --- | --- |
| `index.html` | Startsida med länkar |
| `admin.html` | **Kontrollpanel** för toastmastern: välj/ordna/redigera påståenden och styr showen |
| `stage.html` | **Scenvy** i fullskärm för projektorn |

## Så kör du showen

1. Öppna `admin.html` på datorn som är kopplad till projektorn.
2. Klicka **Öppna scenvy**, dra fönstret till projektorn och tryck **F** (helskärm).
   Klicka en gång i scenfönstret så att ljudeffekterna aktiveras.
3. Tryck **Nästa** i kontrollpanelen. Varje påstående går i tre steg:
   **Påstående → Nedräkning ”3-2-1 peka!” → Avslöja** (nedräkningen kan stängas av).
4. En presentationsklicker eller piltangenterna fungerar direkt i scenfönstret.

Kortkommandon i scenfönstret: `→`/`Mellanslag` nästa · `←` bakåt · `F` helskärm ·
`B` paus · `Home` intro · `End` avslutning · `R` spela upp effekten igen.

Kontrollpanel och scen synkas via webbläsarens lagring, så båda måste vara öppna
**i samma webbläsare på samma dator**. Ändringar sparas automatiskt i webbläsaren.

## Starta lokalt

Allt är statiska filer utan byggsteg och typsnitten ligger lokalt, så det funkar utan internet.
Enklast är att köra en liten webbserver i mappen:

```sh
python3 -m http.server 8000
# öppna http://localhost:8000/admin.html
```

Går också att publicera på GitHub Pages.

## Bilder

Bilderna ligger i `assets/`. Filnamnet anges i `js/data.js` (`VAO.PEOPLE`).
För Tilda letar sidan efter `assets/tilda.jpg` (eller `.jpeg`/`.png`/`.webp`). Tills
bilden finns visas ett monogram. Med `zoom` och `focus` zoomar sidan in på ansiktet, så
att originalbilden kan läggas in som den är.

## Påståenden

Grundlistan finns i `js/data.js`. Första gången sidan öppnas slumpas ordningen,
varvat så att samma person inte kommer mer än två gånger i rad. Ordningen sparas sedan
tills man trycker **Blanda & varva**, **Slumpa helt** eller **Återställ**. Texterna är omskrivna så att de inte avslöjar vem det
gäller (inga ”han”/”hon”). Där originalet hade en poäng som avslöjar personen visas
den i stället först vid avslöjandet (`punchline`). Allt går också att ändra i kontrollpanelen,
där man kan lägga till egna påståenden. Svaret kan vara Tilda, Oliver, **Båda** eller
**Påhittat**, så ni kan lägga in några falska påståenden också.
