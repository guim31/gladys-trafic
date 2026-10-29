# Tráfico

El **tráfico en tiempo real** de varias metrópolis francesas, leído en sus portales de datos
abiertos: Rennes Métropole, Nantes Métropole, Estrasburgo y Bordeaux Métropole. Fluido, denso,
saturado o cortado, vía por vía, y alrededor de su casa. **Sin cuenta ni clave.**

Integración no oficial, sin relación con las metrópolis ni con sus centros de gestión del tráfico.
Las fuentes se comprobaron en directo el 29/10/2026; los comentarios de los usuarios de cada ciudad
son bienvenidos.

## Qué obtiene

- Un **dispositivo por vía** seguida: nivel de tráfico y su nombre (fluido, denso, saturado,
  cortado), velocidad media (Rennes, Nantes, Estrasburgo) o tiempo de recorrido y su valor habitual
  (Burdeos), y la antigüedad de la medida.
- Un **dispositivo «Alrededor de la casa»** por ciudad: los tramos situados a la distancia elegida
  de la casa ubicada en Gladys, reunidos en un solo nivel.
- Un **widget** «Tráfico»: sus vías en una línea cada una, en verde, naranja o rojo.
- Dos **disparadores de escena**: una vía se vuelve densa o saturada, una vía vuelve a ser fluida.
- Una **acción de escena**: el tráfico en sus vías en una frase, lista para enviar o decir.

## Requisitos

- Gladys Assistant **5.3.0** o posterior.
- Acceso a Internet desde Gladys: los datos vienen de los portales de datos abiertos.
- Ni cuenta ni clave de API. Para el dispositivo «Alrededor de la casa», una casa ubicada en Gladys
  (Ajustes → Casas): la integración pide acceso a su ubicación al instalarla.

## Instalación

1. En Gladys, abra **Integraciones → Instalar desde GitHub**.
2. Pegue la dirección `https://github.com/guim31/gladys-trafic` y confirme.
3. Abra la integración una vez instalada: aparece la pestaña **Configuración**.

## Configuración

### Ajustes

| Ajuste                       | Efecto                                                                   |
| ---------------------------- | ------------------------------------------------------------------------ |
| Ciudades                     | las metrópolis cuyas vías se ofrecen en la pestaña Descubrir             |
| Vías a seguir                | parte del nombre de sus vías, separada por comas (3 letras como mínimo)  |
| Alrededor de la casa         | desactivado, 500 m, 1 km (por defecto), 2 km o 3 km alrededor de la casa |
| Actualización                | cada 2, 3 (por defecto) o 5 minutos                                      |
| Idioma de nombres y mensajes | idioma de las funciones, del widget y de las frases de escena (francés)  |

Los nombres de las funciones se fijan al añadir el dispositivo: elija primero el idioma.

### Añadir vías

1. Marque una o varias ciudades y escriba las vías que usa, por ejemplo
   `Route nationale 136, Patton, Schirmeck`. Mayúsculas y acentos no importan. Guarde.
2. Abra la pestaña **Descubrir**: las vías que coinciden aparecen como «Ciudad · Vía» (50 por
   ciudad como máximo), con «Ciudad · Alrededor de la casa» cuando hay tramos a la distancia
   elegida. Para Burdeos se ofrecen siempre los 16 itinerarios.
3. Añada a Gladys las que le interesen. Sus valores llegan enseguida.

Las vías añadidas son las **vías vigiladas**: el widget, los disparadores y la acción de escena las
ofrecen. Una vía añadida se sigue leyendo aunque cambie la búsqueda después.

Una «vía» reúne todos los tramos del portal con ese nombre: en Rennes, una carretera nacional o
departamental de un municipio a otro, una calle dentro de su municipio (el municipio está en el
nombre); en Nantes, los dos sentidos de un bulevar; en Estrasburgo, un punto de medida del centro
de gestión del tráfico.

### Comprobar

La acción **Estado** de la pestaña Configuración lista las ciudades leídas, el número de vías
conocidas, la hora de la última lectura, el último error si lo hay, los tramos alrededor de la casa
y el número de vías añadidas.

## Dispositivos

Cada vía añadida es un dispositivo de solo lectura:

| Función                      | Tipo Gladys        | Valor                                                   |
| ---------------------------- | ------------------ | ------------------------------------------------------- |
| Tráfico                      | texto              | Fluido, Denso, Saturado, Cortado o Desconocido          |
| Nivel de tráfico             | nivel de riesgo    | 0 desconocido, 1 fluido, 2 denso, 3 saturado, 4 cortado |
| Velocidad media              | velocidad (km/h)   | Rennes, Nantes, Estrasburgo                             |
| Tiempo de recorrido          | duración (minutos) | Burdeos: tiempo de recorrido del itinerario             |
| Tiempo de recorrido habitual | duración (minutos) | Burdeos: el valor de referencia publicado con él        |
| Antigüedad del dato          | duración (minutos) | antigüedad de la medida más reciente                    |

El **nivel de una vía** es el peor nivel alcanzado en **al menos una cuarta parte de su longitud**
(en Estrasburgo, que no publica longitudes, cada tramo cuenta una vez): un cruce atascado no satura
toda la circunvalación. La **velocidad media** es la longitud de la vía dividida por su tiempo de
recorrido.

Sin ninguna medida de **menos de 30 minutos**, la vía está **Desconocida** (nivel 0): no se inventa
ningún valor, la velocidad conserva su último valor conocido y la antigüedad del dato sigue
creciendo.

## Widget del panel

Añada el widget **Tráfico** a un panel. Muestra una línea por vía vigilada (diez como máximo), con
el nombre dado en Gladys, por ejemplo «Rocade — Denso · 42 km/h». En los ajustes del widget puede
elegir las vías mostradas (vacío: todas) y ocultar la velocidad o el tiempo de recorrido.

Colores: **verde** fluido, **naranja** denso, **rojo** saturado o cortado, **gris** desconocido.

## Disparadores de escena

| Disparador          | Se produce cuando                                                |
| ------------------- | ---------------------------------------------------------------- |
| Atasco en una vía   | una vía vigilada alcanza el nivel elegido: denso, o saturado     |
| Vía de nuevo fluida | una vía vigilada que estaba densa o saturada vuelve a ser fluida |

El campo **Vías** filtra las vías afectadas; vacío, cualquier vía vigilada. Las variables
disponibles para las acciones siguientes: vía, ciudad, tráfico (el nivel en palabras), velocidad
media.

Los disparadores comparan dos niveles conocidos sucesivos de la vía: nada se dispara cuando un
portal vuelve tras una larga avería, ni mientras la vía está desconocida.

## Acción de escena

**Estado del tráfico en una frase**: el estado de sus vías vigiladas (o de las elegidas).
Resultados:

- `sentence`: «Tráfico: Rocade (denso, 42 km/h). Fluido en el resto.», o «Tráfico fluido en sus
  3 vías vigiladas.»;
- `worst_level`: el peor nivel, de 0 a 4 (para comprobar con «Continuar solo si»);
- `jammed`: el número de vías densas o peor.

La frase sigue el idioma elegido en la configuración.

## Ejemplos de escenas

- **Antes de ir al trabajo**: a las 7:30 los días laborables, acción «Estado del tráfico en una
  frase» y luego «Enviar un mensaje» con `sentence`, o decirla en un altavoz.
- **Circunvalación atascada**: disparador «Atasco en una vía» (circunvalación, saturado) y luego
  una notificación «Salga antes o tome el tren».
- **La carretera está despejada**: disparador «Vía de nuevo fluida» en el trayecto de vuelta y
  luego un mensaje.

## Datos y actualización

| Ciudad      | Portal y conjunto de datos                                        | Actualizado por la ciudad | Tramos         |
| ----------- | ----------------------------------------------------------------- | ------------------------- | -------------- |
| Rennes      | data.rennesmetropole.fr, «État du trafic en temps réel»           | cada pocos minutos        | ~2900          |
| Nantes      | data.nantesmetropole.fr, «Fluidité des axes routiers»             | cada pocos minutos        | ~890           |
| Estrasburgo | data.strasbourg.eu, «SIRAC - flux trafic en temps réel»           | cada 3 minutos            | ~480           |
| Burdeos     | opendata.bordeaux-metropole.fr, «Temps de parcours en temps réel» | cada 2,5 minutos          | 16 itinerarios |

La lista de tramos (nombres, posiciones) se lee **una vez al día** por ciudad. En cada
actualización, una petición por ciudad lee **solo los tramos de las vías añadidas**, filtrados por
el propio portal (una petición más por cada centenar de tramos): unos pocos kilobytes, unas 500
peticiones al día por ciudad a 3 minutos, dentro del uso anónimo de los portales Opendatasoft. Solo
se leen las ciudades marcadas y las de las vías añadidas.

Burdeos no publica estado: el nivel se calcula a partir del tiempo de recorrido comparado con su
valor habitual (hasta 1,3 veces: fluido, hasta 1,8 veces: denso, por encima: saturado). Los tramos
«bloqueados» de Nantes cuentan como saturados. Los contadores de bicicletas de Estrasburgo se
descartan.

## Solución de problemas

- **Ninguna vía en Descubrir**: compruebe que hay una ciudad marcada y una vía escrita (3 letras
  como mínimo) y ejecute la acción **Estado**. Un error «HTTP 503» o «timeout» viene del portal:
  vuelva a intentarlo más tarde.
- **Ningún dispositivo «Alrededor de la casa»**: la casa no tiene ubicación en Gladys, o ningún
  tramo está a la distancia elegida: pruebe una mayor. La acción Estado indica cuántos tramos se
  encontraron.
- **Nivel «Desconocido»**: el portal no ha publicado ninguna medida para esta vía desde hace más de
  30 minutos (de noche, algunos tramos no se miden).
- Para más detalles, ponga `LOG_LEVEL=debug`: cada lectura queda entonces registrada.

## Limitaciones

- Solo se admiten las ciudades indicadas. **Lyon** exige ahora una cuenta para su flujo de tráfico,
  **Grenoble** publica niveles sin el nombre de los tramos, **París** y **Toulouse** solo publican
  recuentos horarios o archivados: estas ciudades podrán añadirse si sus datos lo permiten.
- Las vías son los tramos y nombres de los portales: una vía renombrada por la ciudad se convierte
  en un dispositivo nuevo.
- Los niveles son los de las ciudades (vehículos rastreadores en Rennes, sensores en otros
  lugares): pueden diferir de una aplicación de navegación.
- Solo lectura. Sin relación con las metrópolis.

## Créditos

- Datos: Rennes Métropole, Nantes Métropole, Eurométropole de Strasbourg (SIRAC), Bordeaux
  Métropole, bajo sus respectivas licencias abiertas (Licence Ouverte / ODbL). Nombres de los
  municipios: geo.api.gouv.fr.
- Construida a partir de la
  [plantilla de integración](https://github.com/GladysAssistant/integration-template-js) oficial.
