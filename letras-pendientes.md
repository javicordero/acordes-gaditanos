# Letras pendientes de buscar y ponerle acordes

Cola de trabajo para las coplas de las que solo tenemos la primera frase (o una
frase importante) y el nombre aproximado de la agrupación. El objetivo es
encontrar la letra en internet y aplicarle los acordes de otra ficha de la misma
música, como se hizo con *El Nazareno greñuo*.

**Estados**

| Estado | Qué significa |
|---|---|
| `pendiente` | Aún no se ha buscado (o se está buscando) |
| `encontrada` | Letra localizada y guardada en `.cache/`, sin acordes todavía |
| `con acordes` | Ficha creada en `src/content/acordes/` con los acordes puestos |
| `no encontrada` | Buscada sin éxito (se deja anotado dónde se miró) |
| `duplicada` | Ya está en la lista con otro número |

**Cómo se trabaja** (lo automatiza `npm run letras`)

```bash
npm run letras                      # ver la cola
npm run letras -- siguiente         # primer pendiente con su ficha base
npm run letras -- estado 5 encontrada --fuente <url> --notas "gcarnavaldecadiz"
npm run letras -- estado 5 "con acordes" --ficha pasodoble-los-mafiosos-la-sonrisa
npm run letras -- auditar           # comprueba estados contra las fichas reales
```

La columna **Base** es la ficha cuyos acordes se copian (misma música). Las que
llevan `?` hay que resolverlas mirando el listado de agrupaciones del cancionero.

| # | Letra (frase) | Agrupación | Base | Estado | Ficha | Fuente | Notas |
|---|---|---|---|---|---|---|---|
| 1 | Esta la canto en gaditano | La Sereníssima | pasodoble-la-serenissima | con acordes | pasodoble-la-serenissima-esta-la-canto-en-gaditano | https://compasgaditano.com/2012/02/esta-la-canto-en-gaditano-la-serenissima.html | 22 versos; 1 aviso de metrica (v22) |
| 2 | Yo cantaré porque tengo los días contados | La Eternidad | pasodoble-la-eternidad | con acordes | pasodoble-la-eternidad-yo-cantare | http://letrasdesdeelparaiso.blogspot.com/2017/04/pasodoble-cantar-eterno-la-eternidad.html | inedito de 2017; lineas reconstruidas a mano; avisos v4, v20, v28 |
| 3 | El nazareno greñuo | Los Ángeles caídos | pasodoble-los-angeles-caidos | con acordes | pasodoble-los-angeles-caidos-el-nazareno-grenuo |  | hecha a mano con el flujo nuevo |
| 4 | Yo sé que la gente piensa | Los Yesterday | pasodoble-los-yesterday | con acordes | pasodoble-los-yesterday-yo-se-que-la-gente-piensa | https://compasgaditano.com/2006/11/yo-se-que-la-gente-piensa-que-los-jipis.html | 1 aviso de metrica (v17) |
| 5 | La sonrisa es un te quiero | Los mafiosos | pasodoble-los-mafiosos | con acordes | pasodoble-los-mafiosos-la-sonrisa-es-un-te-quiero | https://www.alsondelcarnaval.es/letras/letras-comparsa-los-mafiosos | 2 avisos de metrica (v8, v24) |
| 6 | El Cádiz | DSAS3 | pasodoble-dsas3 | con acordes | pasodoble-dsas3-el-cadiz-que-a-ti-te-enamora | http://letrasdesdeelparaiso.blogspot.com/2026/02/pasodoble-el-cadiz-que-ti-te-enamora.html | 2 avisos de metrica (v15, v16) |
| 7 | Sandía | DSAS3 | pasodoble-dsas3 | con acordes | pasodoble-dsas3-sandia-de-piel-que-se-estira | http://letrasdesdeelparaiso.blogspot.com/2026/02/pasodoble-sandia-de-piel-que-se-estira.html | revisar metricas v9, 19, 22, 24 |
| 8 | Mi chirigota los currelantes | Los Currelantes | pasodoble-los-currelantes | con acordes | pasodoble-los-currelantes-mi-chirigota | https://compasgaditano.com/2011/02/mi-chirigota-los-currelantes.html | revisar metricas v8, 10, 14, 17, 22 |
| 9 | A caparros | Las Ratas | pasodoble-las-ratas | con acordes | pasodoble-las-ratas-manuel | http://letrasdesdeelparaiso.blogspot.com/2025/02/pasodoble-manuel-los-ratas-letra.html | revisar metricas v1, 3, 8, 15, 18, 21 |
| 10 | Come cuando tiene frío | Los carnívales | pasodoble-los-carnivales | con acordes | pasodoble-los-carnivales-come-cuando-tiene-sueno | http://letrasdesdeelparaiso.blogspot.com/2019/02/pasodoble-come-cuando-tiene-sueno-los.html | el titulo era Come cuando tiene sueno; 5 avisos (v6, 9, 17, 23, 26) |
| 11 | La fiesta los reyes magos | Las huestes de don Nuño | pasodoble-las-huestes-de-don-nuño | con acordes | pasodoble-las-huestes-de-don-nuno-la-fiesta-los-reyes-magos | http://coplasdelcarnaval.blogspot.com/2012/01/comparsa-las-huestes-de-don-nuno-1959.html | 3 avisos de metrica (v13, 16, 18) |
| 12 | En un rincón del planeta | La canción de Cádiz | pasodoble-la-cancion-de-cadiz | con acordes | pasodoble-la-cancion-de-cadiz-en-un-rincon-del-planeta | http://aprenderlenguaesdivertido.blogspot.com/2014/03/comparsa-la-cancion-de-cadiz.html | 2 avisos de metrica (v3, v13) |
| 13 | Despacio y que suenen las horquillas | Los Gadiritas | pasodoble-los-gadiritas | con acordes | pasodoble-los-gadiritas-despacio-y-que-suenen-las-horquillas | http://carnavalyactualidad.blogspot.com/2016/01/comparsa-los-gadiritas.html | version con un verso por linea; 3 avisos (v4, 14, 16) |
| 14 | Ya se fue don Manuel | Mejó no salgo | pasodoble-mejo-no-salgo | con acordes | pasodoble-mejo-no-salgo-ya-se-fue-don-manuel | http://letrasdcarnaval.blogspot.com/2012/04/manuel-fraga-mejo-no-salgo-2012.html | estaba en letrasdcarnaval (otro blog), no en Guitarra de Gades; 2 avisos (v10, v19) |
| 15 | Hoy te he mirao | El espíritu de Cádiz | pasodoble-el-espiritu-de-cadiz | con acordes | pasodoble-el-espiritu-de-cadiz-hoy-te-he-mirao | https://www.alsondelcarnaval.es/letras/pasodoble-hoy-te-he-mirado-comparsa-el-espiritu-de-cadiz/ | 2 avisos de metrica (v8, v10) |
| 16 | Presume del orgullo | Los Quinquis | pasodoble-los-quinquis | con acordes | pasodoble-los-quinquis-reniegas-del-orgullo | https://www.alsondelcarnaval.es/letras/letras-comparsa-los-quinquis | el titulo real es Reniegas del orgullo; 1 aviso de metrica (v6) |
| 17 | A Macarena Olona | Los Quinquis | pasodoble-los-quinquis | con acordes | pasodoble-los-quinquis-tu-no-eres-andaluza | https://letrasdesdeelparaiso.blogspot.com/2022/05/pasodoble-tu-no-eres-andaluza-los.html | 1 aviso de metrica (v2) |
| 18 | Tú que me vas a contar | Los Cadizfornia | pasodoble-los-cadizfornia | con acordes | pasodoble-los-cadizfornia-tu-que-me-vas-a-contar | http://letrasdesdeelparaiso.blogspot.com/2020/02/pasodoble-tu-los-cadizfornia-letra.html | revisar metricas v9, 12, 25 |
| 19 | Al machismo | Los niños sin nombre | pasodoble-los-ninos-sin-nombre | con acordes | pasodoble-los-ninos-sin-nombre-escucha-un-momento | https://compasgaditano.com/2019/04/escucha-un-momento-los-ninos-sin-nombre.html | sin avisos |
| 20 | La cama grande | Los Cagones | pasodoble-los-cagones | con acordes | pasodoble-los-cagones-la-cama-grande | https://compasgaditano.com/2025/02/en-la-casa-existe-un-rincon-los-cagones.html | revisar metricas v2, 3, 4, 5, 8, 9, 14, 18 |
| 21 | Por ti carnaval | Los peregrinos | pasodoble-los-peregrinos | con acordes | pasodoble-los-peregrinos-por-ti-carnaval | http://letrasdesdeelparaiso.blogspot.com/2017/05/pasodoble-por-ti-carnaval-los.html | revisar metricas v10, 16, 29 |
| 22 | Para que escuchen tu canto | Los Millonarios | pasodoble-los-millonarios | con acordes | pasodoble-los-millonarios-para-que-escuchen-tu-canto | http://letrasdesdeelparaiso.blogspot.com/2019/05/pasodoble-para-que-escuchen-tu-canto.html | revisar metricas v2, 7, 18, 30, 37, 41 |
| 23 | Qué poquísima vergüenza | Catastrophic Magic Band | pasodoble-catastrophic-magic-band | con acordes | pasodoble-catastrophic-magic-band-que-poquisima-verguenza | http://letrasdesdeelparaiso.blogspot.com/2019/05/pasodoble-el-truco-de-la-serenissima.html | 4 avisos de metrica (v5, 13, 14, 15) |
| 24 | En los salones de una escuela | Los Parias | pasodoble-los-parias | con acordes | pasodoble-los-parias-en-los-salones-de-una-escuela | http://letrasdesdeelparaiso.blogspot.com/2019/01/pasodoble-en-los-salones-de-una-escuela.html | revisar metricas v4, 13, 18 |
| 25 | Ay si yo fuera un enano | Los Ángeles caídos | pasodoble-los-angeles-caidos | con acordes | pasodoble-los-angeles-caidos-ay-si-yo-fuera-un-enano | https://www.alsondelcarnaval.es/letras/comparsa-los-angeles-caidos | 2 avisos de metrica (v9, v18) |
| 26 | En un rincón del planeta | La canción de Cádiz | pasodoble-la-cancion-de-cadiz | duplicada |  |  | repetida: ver 12 |
| 27 | Miércoles azul de carnavales | Los Esclavos | pasodoble-los-esclavos | con acordes | pasodoble-los-esclavos-miercoles-azul-de-carnavales | https://www.alsondelcarnaval.es/letras/letra-comparsa-los-esclavos | sin avisos |
| 28 | Cuéntame de cuando salías | Los templarios | pasodoble-los-templarios | pendiente |  | https://www.codigocarnaval.com/articulos/pasodobles-ineditos-de-martinez-ares | el unico articulo mezcla comentario y letra; se busca de nuevo mas adelante |
| 29 | Dios mío que me estoy secando | Los templarios | pasodoble-los-templarios | con acordes | pasodoble-los-templarios-dios-mio-que-me-estoy-secando | https://letrasdecarnaval.com/letra/comparsa-los-templarios-1999-pasodoble-dios-mio-que-me-estoy-secando | extraida de <p id=letra>; 1 aviso (v10) |
| 30 | Era un 4 de diciembre | Los Piratas | pasodoble-los-piratas | con acordes | pasodoble-los-piratas-era-un-cuatro-de-diciembre | https://compasgaditano.com/2011/12/era-un-cuatro-de-diciembre-los-piratas.html | sin avisos |
| 31 | La venganza y la locura | Los Condenaos | pasodoble-los-condenaos | con acordes | pasodoble-los-condenaos-la-venganza-y-la-locura | http://letrasdesdeelparaiso.blogspot.com/2018/01/pasodoble-la-venganza-y-la-locura-los.html | 1 aviso de metrica (v11) |
| 32 | La pantera de un pantera | Los Panteras | pasodoble-los-panteras | con acordes | pasodoble-los-panteras-la-pantera-de-un-pantera | https://letrasdesdeelparaiso.blogspot.com/2018/01/pasodoble-la-pantera-de-un-pantera-los.html | 2 avisos de metrica (v6, v10) |
| 33 | A Camarón | Los Panteras | pasodoble-los-panteras | con acordes | pasodoble-los-panteras-yo-no-se-si-soy-ateo | https://letrasdesdeelparaiso.blogspot.com/2018/01/pasodoble-yo-no-se-si-soy-ateo-los.html | el titulo real es Yo no se si soy ateo; 5 avisos de metrica (v1, 3, 7, 18, 21) |
| 34 | Yo quiero que esta tribu | Los Americanos | pasodoble-los-americanos | con acordes | pasodoble-los-americanos-yo-quiero-que-esta-tribu-tenga-un-alcalde | http://letrasdesdeelparaiso.blogspot.com/2018/03/pasodoble-yo-quiero-que-esta-tribu.html | revisar metricas v4, 7, 16, 20 |
| 35 | En mis entrañitas | Los vikingos | pasodoble-los-vikingos | con acordes | pasodoble-los-vikingos-en-mis-entranitas | https://letrasdecarnaval.com/letra/comparsa-los-vikingos-2003-pasodoble-en-mis-entranitas-te-llevo-metia | empieza en Fa#7 Sim7: se salta el verso de entrada de la base con un guion; revisar v5, 6, 8, 9, 11 |
| 36 | Quién sería el capitán | 1800 Los Inmortales | pasodoble-1800-los-inmortales | con acordes | pasodoble-1800-los-inmortales-quien-seria-el-capitan | http://letrasdesdeelparaiso.blogspot.com/2018/12/pasodoble-quien-seria-el-capitan-1800.html | 1 aviso de metrica (v8) |
| 37 | En este mundo lleno | Araka La Kana | pasodoble-araka-la-kana | con acordes | pasodoble-araka-la-kana-en-este-mundo-lleno | http://letrasdesdeelparaiso.blogspot.com/2019/01/pasodoble-en-este-mundo-lleno-araka-la.html | sin avisos |
| 38 | Quién quiera presumir | Araka La Kana | pasodoble-araka-la-kana | con acordes | pasodoble-araka-la-kana-quien-quiera-presumir | http://letrasdesdeelparaiso.blogspot.com/2019/01/pasodoble-quien-quiera-presumir-araka.html | 1 aviso de metrica (v1) |
| 39 | Nombres | Los Santos | pasodoble-los-santos | con acordes | pasodoble-los-santos-nombres | https://www.alsondelcarnaval.es/letras/pasodoble-nombres-comparsa-los-santos/ | version con un verso por linea; 2 avisos (v7, v9) |
| 40 | La soledad es testigo | La banda del Capitán Veneno | pasodoble-la-banda-del-capitan-veneno | con acordes | pasodoble-la-banda-del-capitan-veneno-la-soledad-es-testigo | https://letrasdesdeelparaiso.blogspot.com/2019/01/pasodoble-la-soledad-es-testigo-la.html | version del blog; revisar v3, 6, 21, 28 |
| 41 | Cuando pienso en un genio | Los comparsistas se la dan de artistas | pasodoble-los-comparsistas-se-la-dan-de-artistas | con acordes | pasodoble-los-comparsistas-se-la-dan-de-artistas-cuando-pienso-en-un-genio | http://letrasdesdeelparaiso.blogspot.com/2019/01/pasodoble-cuando-pienso-en-un-genio-y.html | revisar metricas v25, 29, 36 |
| 42 | Voy a contar hasta 20 | Los Trasnochadores | pasodoble-los-trasnochadores | con acordes | pasodoble-los-trasnochadores-voy-a-contar-hasta-20 | http://carnavaldecadiz-elio.blogspot.com/2010/09/los-trasnochadores.html | el .txt traia dos pasodobles; cortado a 16 lineas; 2 avisos (v12, v13) |
| 43 | La amistad tiene la llave | Los Trasnochadores | pasodoble-los-trasnochadores | con acordes | pasodoble-los-trasnochadores-la-amistad-tiene-la-llave | http://carnavaldecadiz-elio.blogspot.com/2010/09/los-trasnochadores.html | el .txt traia dos pasodobles; cortado a 18 lineas; 1 aviso (v20) |

## Historial

### 2026-10-31 · alta de la lista

Se crea la lista con las 43 entradas (la 26 es repetición de la 12). La 3 ya
estaba hecha. La 40 viene sin agrupación.

### Primera pasada completa

Búsqueda de las 43 con `Pasodoble "<frase>"` y la agrupación como filtro.
Resultado: **26 fichas publicadas**, **14 letras localizadas** pendientes de
afinar el reparto y **2 sin encontrar**.

- Varias frases no eran el título real: «A caparros» es *Manuel* (Las Ratas),
  «A Macarena Olona» es *Tú no eres andaluza* (Los Quinquis), «Presume del
  orgullo» es *Reniegas del orgullo* (Los Quinquis), «Al machismo» es *Escucha
  un momento* (Los niños sin nombre). «Come cuando tiene frío» no aparece en el
  repertorio conocido de Los Carnívales.
- Las letras en `encontrada` tienen la fuente anotada y un reparto que no cuadra
  con la base (más de ~8 versos con aviso). Se revisan a mano con
  `npm run acordes:revisar` antes de publicarlas.
- Las que están en `con acordes` pero llevan avisos en `Notas` publican con la
  métrica algo descuadrada; el sitio de los acordes es correcto.
- «La soledad es testigo» (40) es de La Banda del Capitán Veneno; se añadieron
  agrupación y base.

