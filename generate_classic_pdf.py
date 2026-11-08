import os
import base64
import subprocess
import pymupdf

img_dir = r"C:\Users\jorge\.gemini\antigravity\brain\e715f7b3-9832-4d17-983b-f4c3fa73ec63\extracted_images"

def get_b64(filename):
    path = os.path.join(img_dir, filename)
    if os.path.exists(path):
        with open(path, "rb") as f:
            return "data:image/png;base64," + base64.b64encode(f.read()).decode("utf-8")
    return ""

b64_header = get_b64("page_1_img_1_35.png")
b64_logo = get_b64("page_2_img_1_40.png")
b64_photo = get_b64("page_3_img_1_44.png")
b64_survey_intent = get_b64("page_12_img_2_111.png")

svg_blueprint = """<svg width="100%" height="340" viewBox="0 0 500 420" xmlns="http://www.w3.org/2000/svg" style="background:#FAFCFF; font-family:Arial, sans-serif;">
  <defs>
    <linearGradient id="yogurtGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F1F5F9"/>
    </linearGradient>
    <linearGradient id="granolaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FEF3C7"/>
      <stop offset="100%" stop-color="#FDE68A"/>
    </linearGradient>
    <linearGradient id="berryGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FEE2E2"/>
      <stop offset="100%" stop-color="#FECACA"/>
    </linearGradient>
    <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#1E3A5F"/>
    </marker>
  </defs>

  <!-- Rejilla técnica sutil de fondo -->
  <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#E2E8F0" stroke-width="0.8"/>
  </pattern>
  <rect width="500" height="420" fill="url(#grid)" />

  <!-- Capa 1: Base Yogurt Griego -->
  <polygon points="195,230 305,230 290,340 210,340" fill="url(#yogurtGrad)" stroke="#94A3B8" stroke-width="1.2"/>
  
  <!-- Capa 2: Granola Crujiente -->
  <polygon points="185,175 315,175 305,230 195,230" fill="url(#granolaGrad)" stroke="#D97706" stroke-width="1.2"/>
  <circle cx="215" cy="195" r="3.5" fill="#B45309" opacity="0.6"/>
  <circle cx="245" cy="190" r="4" fill="#92400E" opacity="0.7"/>
  <circle cx="275" cy="205" r="3" fill="#B45309" opacity="0.6"/>
  <circle cx="230" cy="215" r="4" fill="#581C87" opacity="0.7"/>
  <circle cx="285" cy="190" r="4.5" fill="#4C1D95" opacity="0.7"/>

  <!-- Capa 3: Frutos Rojos Mixtos -->
  <polygon points="175,105 325,105 315,175 185,175" fill="url(#berryGrad)" stroke="#DC2626" stroke-width="1.2"/>
  <circle cx="210" cy="135" r="8.5" fill="#DC2626" opacity="0.8"/>
  <circle cx="235" cy="125" r="7.5" fill="#991B1B" opacity="0.8"/>
  <circle cx="265" cy="130" r="8" fill="#4C1D95" opacity="0.8"/>
  <circle cx="290" cy="140" r="8.5" fill="#B91C1C" opacity="0.8"/>
  <circle cx="250" cy="155" r="8" fill="#6B21A8" opacity="0.8"/>

  <!-- Contorno Principal del Vaso PET (Troncocónico) -->
  <polygon points="175,105 325,105 290,340 210,340" fill="none" stroke="#1E3A5F" stroke-width="2.5"/>
  <ellipse cx="250" cy="340" rx="40" ry="6" fill="#E2E8F0" stroke="#1E3A5F" stroke-width="2"/>
  <ellipse cx="250" cy="105" rx="75" ry="8" fill="none" stroke="#1E3A5F" stroke-width="2"/>

  <!-- Tapa Domo Transparente -->
  <path d="M 170 105 C 170 45, 330 45, 330 105 Z" fill="#93C5FD" fill-opacity="0.15" stroke="#2563EB" stroke-width="2" stroke-dasharray="5 3"/>

  <!-- Etiqueta Oficial en el Centro -->
  <circle cx="250" cy="275" r="23" fill="#FFFFFF" stroke="#2D5A27" stroke-width="2"/>
  <text x="250" y="272" text-anchor="middle" font-size="7.5" font-weight="bold" fill="#2D5A27">VIDA VERDE</text>
  <text x="250" y="283" text-anchor="middle" font-size="6" fill="#166534">Yogurt Griego</text>

  <!-- Cotas Técnicas -->
  <!-- Cota Altura Total (135 mm) -->
  <line x1="130" y1="50" x2="160" y2="50" stroke="#94A3B8" stroke-width="1"/>
  <line x1="130" y1="340" x2="200" y2="340" stroke="#94A3B8" stroke-width="1"/>
  <line x1="140" y1="56" x2="140" y2="334" stroke="#1E3A5F" stroke-width="1.5" marker-start="url(#arrow)" marker-end="url(#arrow)"/>
  <text x="132" y="195" text-anchor="middle" font-size="12" font-weight="bold" fill="#1E3A5F" transform="rotate(-90 132 195)">135 mm (Total)</text>

  <!-- Cota Boca (Ø 92 mm) -->
  <line x1="175" y1="80" x2="175" y2="100" stroke="#94A3B8" stroke-width="1"/>
  <line x1="325" y1="80" x2="325" y2="100" stroke="#94A3B8" stroke-width="1"/>
  <line x1="181" y1="88" x2="319" y2="88" stroke="#1E3A5F" stroke-width="1.5" marker-start="url(#arrow)" marker-end="url(#arrow)"/>
  <text x="250" y="82" text-anchor="middle" font-size="12" font-weight="bold" fill="#1E3A5F">&Oslash; 92 mm (Boca)</text>

  <!-- Cota Base (Ø 58 mm) -->
  <line x1="210" y1="355" x2="210" y2="375" stroke="#94A3B8" stroke-width="1"/>
  <line x1="290" y1="355" x2="290" y2="375" stroke="#94A3B8" stroke-width="1"/>
  <line x1="216" y1="368" x2="284" y2="368" stroke="#1E3A5F" stroke-width="1.5" marker-start="url(#arrow)" marker-end="url(#arrow)"/>
  <text x="250" y="388" text-anchor="middle" font-size="12" font-weight="bold" fill="#1E3A5F">&Oslash; 58 mm (Base)</text>

  <!-- Llamadas Técnicas -->
  <path d="M 295 65 L 345 65" stroke="#4B5563" stroke-width="1"/>
  <circle cx="295" cy="65" r="2.5" fill="#2563EB"/>
  <text x="350" y="69" font-size="11" font-weight="bold" fill="#1E3A5F">Tapa domo PET</text>

  <path d="M 320 140 L 345 140" stroke="#4B5563" stroke-width="1"/>
  <circle cx="320" cy="140" r="2.5" fill="#DC2626"/>
  <text x="350" y="137" font-size="11" font-weight="bold" fill="#991B1B">Corona Frutos (60g)</text>
  <text x="350" y="150" font-size="9.5" fill="#4B5563">Fresa, mora, ar&aacute;ndano</text>

  <path d="M 310 205 L 345 205" stroke="#4B5563" stroke-width="1"/>
  <circle cx="310" cy="205" r="2.5" fill="#D97706"/>
  <text x="350" y="202" font-size="11" font-weight="bold" fill="#B45309">Granola Capa (40g)</text>
  <text x="350" y="215" font-size="9.5" fill="#4B5563">Horneada crujiente</text>

  <path d="M 300 285 L 345 285" stroke="#4B5563" stroke-width="1"/>
  <circle cx="300" cy="285" r="2.5" fill="#1E3A5F"/>
  <text x="350" y="282" font-size="11" font-weight="bold" fill="#1E3A5F">Yogurt Base (150g)</text>
  <text x="350" y="295" font-size="9.5" fill="#4B5563">Griego sin az&uacute;car</text>
</svg>"""

html_content = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Presentación Plan de Negocio - Vida Verde</title>
<style>
@page {{
    size: 1920px 1080px;
    margin: 0;
}}
* {{
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}}
body {{
    font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
    background-color: #FFFFFF;
    color: #222222;
    -webkit-font-smoothing: antialiased;
}}
.slide {{
    width: 1920px;
    height: 1080px;
    page-break-after: always;
    break-after: page;
    position: relative;
    overflow: hidden;
    background-color: #FFFFFF;
    padding: 55px 85px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
}}

/* Encabezado Clásico de Presentación */
.slide-header {{
    border-bottom: 2.5px solid #1E3A5F;
    padding-bottom: 14px;
    margin-bottom: 28px;
}}
.slide-title {{
    font-size: 38px;
    font-weight: bold;
    color: #1E3A5F;
    line-height: 1.15;
}}
.slide-meta {{
    font-size: 18px;
    color: #4B5563;
    margin-top: 6px;
    font-weight: 500;
}}

/* Cuerpo de Diapositiva */
.slide-body {{
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
}}

/* Tipografía y Listas Clásicas */
h3.section-title {{
    font-size: 23px;
    color: #1E3A5F;
    font-weight: bold;
    margin-bottom: 16px;
    padding-bottom: 6px;
    border-bottom: 1px solid #D1D5DB;
}}
ul.classic-list {{
    list-style-type: square;
    padding-left: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
}}
ul.classic-list li {{
    font-size: 19px;
    line-height: 1.55;
    color: #2D3748;
}}
ul.classic-list li strong {{
    color: #111827;
}}

/* Tablas Clásicas Estilo PowerPoint */
table.classic-table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 17px;
    border: 1px solid #CBD5E1;
}}
table.classic-table th {{
    background-color: #1E3A5F;
    color: #FFFFFF;
    font-weight: bold;
    text-align: left;
    padding: 13px 16px;
    border: 1px solid #1E3A5F;
}}
table.classic-table td {{
    padding: 12px 16px;
    border: 1px solid #E2E8F0;
    color: #2D3748;
}}
table.classic-table tr:nth-child(even) {{
    background-color: #F8FAFC;
}}
table.classic-table tr.highlight-row {{
    background-color: #F0FDF4;
    font-weight: bold;
    color: #166534;
}}

/* Portada Clásica */
.cover-slide {{
    padding: 55px 90px 50px 90px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    text-align: center;
}}
.cover-header-logos {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2.5px solid #1E3A5F;
    padding-bottom: 22px;
}}
.cover-inst-title {{
    font-size: 28px;
    font-weight: bold;
    color: #1E3A5F;
    letter-spacing: 0.5px;
}}
.cover-inst-sub {{
    font-size: 18px;
    color: #4B5563;
    font-weight: bold;
    margin-top: 4px;
}}
.cover-center-content {{
    margin: 36px 0;
}}
.cover-main-title {{
    font-size: 52px;
    font-weight: 900;
    color: #1E3A5F;
    margin-bottom: 14px;
    letter-spacing: -0.5px;
}}
.cover-project-title {{
    font-size: 32px;
    font-weight: bold;
    color: #2D5A27;
    margin-bottom: 16px;
}}
.cover-desc-text {{
    font-size: 19px;
    color: #4B5563;
    max-width: 1100px;
    margin: 0 auto;
    line-height: 1.6;
}}
.cover-info-columns {{
    display: grid;
    grid-template-columns: 1.35fr 0.65fr;
    gap: 50px;
    border-top: 1.5px solid #CBD5E1;
    padding-top: 26px;
    text-align: left;
}}
.cover-team-list {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 20px;
    font-size: 16px;
    color: #374151;
}}
</style>
</head>
<body>

<!-- ========================================== -->
<!-- PÁGINA 1: PORTADA CLÁSICA INSTITUCIONAL    -->
<!-- ========================================== -->
<div class="slide cover-slide">
    <div class="cover-header-logos">
        <div style="text-align: left;">
            <div class="cover-inst-title">UNIVERSIDAD TECNOL&Oacute;GICA DE MATAMOROS</div>
            <div class="cover-inst-sub">CARRERA DE INGENIER&Iacute;A EN SISTEMAS PRODUCTIVOS</div>
            <div style="font-size: 16px; color: #2D5A27; font-weight: bold; margin-top: 4px;">ASIGNATURA: INTEGRADORA II &bull; GRUPO: 4ISP2V</div>
        </div>
        <div>
            <img src="{b64_header}" style="height: 58px; object-fit: contain;" alt="Logos Oficiales" />
        </div>
    </div>

    <div class="cover-center-content">
        <div class="cover-main-title">PLAN DE NEGOCIO Y RENTABILIDAD</div>
        <div class="cover-project-title">PROYECTO: "VIDA VERDE"</div>
        <div style="font-size: 24px; font-weight: bold; color: #374151; margin-bottom: 16px;">
            Yogurt Griego con Granola y Frutos Rojos (Presentaci&oacute;n Vaso 12 oz)
        </div>
        <div class="cover-desc-text">
            Propuesta de negocio y dise&ntilde;o de producto para la elaboraci&oacute;n y comercializaci&oacute;n de un snack funcional, saludable y listo para consumir en el entorno universitario de la UTM.
        </div>
    </div>

    <div class="cover-info-columns">
        <div>
            <div style="font-size: 16px; font-weight: bold; color: #1E3A5F; margin-bottom: 12px; text-transform: uppercase;">
                Integrantes del Equipo de Trabajo:
            </div>
            <div class="cover-team-list">
                <div>&bull; (2310811) Aguilar Flores Heliberto</div>
                <div>&bull; (2310882) Ortega Aguilar Jorge Luis</div>
                <div>&bull; (2310821) Garc&iacute;a Berrones Edgar Giovanni</div>
                <div>&bull; (2310769) Garc&iacute;a Guzm&aacute;n Carlos Eduardo</div>
                <div>&bull; (2310885) Recendez Hern&aacute;ndez Jaretzy</div>
                <div>&bull; (2311038) Salazar &Aacute;lvarez Julio</div>
                <div>&bull; (2310778) Tovar Zamarripa Christopher No&eacute;</div>
            </div>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; border-left: 1.5px solid #CBD5E1; padding-left: 35px;">
            <div>
                <div style="font-size: 16px; color: #1F2937; margin-bottom: 8px;"><strong>Docente:</strong> Lic./Ing. Lizeth Cano Moreno</div>
                <div style="font-size: 16px; color: #1F2937; margin-bottom: 8px;"><strong>Lugar:</strong> H. Matamoros, Tamaulipas</div>
                <div style="font-size: 15px; color: #4B5563;"><strong>Fecha de Entrega:</strong> 16 de Octubre de 2026</div>
            </div>
            <img src="{b64_logo}" style="height: 85px; object-fit: contain;" alt="Logo Vida Verde" />
        </div>
    </div>
</div>

<!-- ========================================== -->
<!-- PÁGINA 2: DIAPOSITIVA 1 (PUNTO 1)          -->
<!-- ========================================== -->
<div class="slide">
    <div class="slide-header">
        <div class="slide-title">1. Presentaci&oacute;n del Proyecto</div>
        <div class="slide-meta">
            <span>An&aacute;lisis del plan de negocio</span>
        </div>
    </div>

    <div class="slide-body">
        <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 50px; height: 100%;">
            <!-- Columna Izquierda -->
            <div>
                <h3 class="section-title">Concepto del Negocio y Filosof&iacute;a</h3>
                <ul class="classic-list">
                    <li>
                        <strong>Nombre Comercial:</strong> "Vida Verde".
                    </li>
                    <li>
                        <strong>Descripci&oacute;n del Negocio:</strong> Elaboraci&oacute;n y venta de vasos con capas de yogurt griego natural, granola crujiente y frutos rojos frescos (fresa, ar&aacute;ndano y mora), con cuchara desechable incluida.
                    </li>
                    <li>
                        <strong>Misi&oacute;n (&iquest;Qu&eacute; hacemos hoy?):</strong> Ofrecer a los estudiantes y trabajadores una opci&oacute;n de desayuno o snack que sea r&aacute;pida, a buen precio y sobre todo saludable, prepar&aacute;ndolo todos los d&iacute;as con ingredientes frescos para que coman rico aunque tengan prisa.
                    </li>
                    <li>
                        <strong>Visi&oacute;n (&iquest;A d&oacute;nde queremos llegar?):</strong> Convertirnos en la opci&oacute;n n&uacute;mero uno de snacks saludables dentro de nuestra universidad y alrededores, demostrando que la comida r&aacute;pida tambi&eacute;n puede ser buena para la salud, y en un futuro, crecer para usar empaques 100% ecol&oacute;gicos.
                    </li>
                    <li>
                        <strong>Objetivo del Negocio:</strong> Establecer un modelo &aacute;gil de manufactura diaria que satisfaga la demanda en los cambios de hora de clase con una meta inicial de venta de 15 vasos diarios.
                    </li>
                </ul>
            </div>

            <!-- Columna Derecha -->
            <div style="display: flex; flex-direction: column; justify-content: flex-start;">
                <h3 class="section-title">Pol&iacute;tica de Calidad y Marca</h3>
                <div style="text-align: center; margin: 15px 0 25px 0;">
                    <img src="{b64_logo}" style="height: 125px; object-fit: contain;" alt="Logotipo Vida Verde" />
                    <div style="font-size: 15px; color: #4B5563; margin-top: 8px; font-style: italic;">Logotipo y distintivo de marca "Vida Verde"</div>
                </div>
                <ul class="classic-list">
                    <li>
                        <strong>Preparaci&oacute;n Matutina:</strong> Preparamos los vasos la misma ma&ntilde;ana que te los vas a comer (6:00 AM).
                    </li>
                    <li>
                        <strong>Cero Producto Reciclado:</strong> No reciclamos producto ni guardamos para el d&iacute;a siguiente. Siempre crujiente, siempre natural.
                    </li>
                    <li>
                        <strong>Compromiso con el Cliente:</strong> Porciones exactas y control estricto de higiene para estudiantes y trabajadores con prisa.
                    </li>
                </ul>
            </div>
        </div>
    </div>
</div>

<!-- ========================================== -->
<!-- PÁGINA 3: DIAPOSITIVA 2 (PUNTO 2)          -->
<!-- ========================================== -->
<div class="slide">
    <div class="slide-header">
        <div class="slide-title">2. Problema o Necesidad</div>
        <div class="slide-meta">
            <span>An&aacute;lisis del plan de negocio</span>
        </div>
    </div>

    <div class="slide-body">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 50px; height: 100%;">
            <!-- Problema -->
            <div>
                <h3 class="section-title">&iquest;Qu&eacute; Problema Existe en el Mercado?</h3>
                <ul class="classic-list">
                    <li>
                        <strong>Predominio de Alimentos Poco Saludables:</strong> La oferta en cafeter&iacute;as escolares y tienditas cercanas est&aacute; saturada de frituras, galletas, refrescos y harinas refinadas con alto contenido cal&oacute;rico y nulo valor biol&oacute;gico.
                    </li>
                    <li>
                        <strong>Falta de Tiempo de Alumnos y Docentes:</strong> Las jornadas acad&eacute;micas continuas y clases que inician a las 7:00 AM provocan que muchos salgan de su hogar sin desayunar y carezcan de tiempo para hacer filas de 15 minutos en la cafeter&iacute;a.
                    </li>
                    <li>
                        <strong>Opciones Comerciales Costosas:</strong> En franquicias externas o cafeter&iacute;as especializadas, los vasos de yogurt con fruta rondan entre $65.00 y $85.00 MXN, un costo elevado para el presupuesto del estudiante promedio.
                    </li>
                    <li>
                        <strong>Falta de Practicidad en Supermercados:</strong> Los yogurts convencionales de tienda no incluyen fruta fresca del d&iacute;a ni cuchara desechable, dificultando su consumo dentro de las aulas.
                    </li>
                </ul>
            </div>

            <!-- Necesidad Satisfecha -->
            <div>
                <h3 class="section-title">&iquest;Qu&eacute; Necesidad Satisface "Vida Verde"?</h3>
                <ul class="classic-list">
                    <li>
                        <strong>Desayuno R&aacute;pido y Nutritivo:</strong> Brinda una alternativa balanceada con prote&iacute;na l&aacute;ctea de alta asimilaci&oacute;n (yogurt griego), carbohidratos complejos (granola de avena) y antioxidantes naturales (frutos rojos).
                    </li>
                    <li>
                        <strong>Listo para Llevar ("On-the-go"):</strong> Formato ergon&oacute;mico en vaso sellado con tapa domo y cuchara individual incluida; listo para destapar y consumir sin necesidad de sentarse ni ensuciarse.
                    </li>
                    <li>
                        <strong>Frescura y Sabor Garantizado:</strong> Elaborado el mismo d&iacute;a de venta, lo que mantiene la granola 100% crujiente y la fruta con su textura natural, sin conservadores qu&iacute;micos.
                    </li>
                    <li>
                        <strong>Precio Accesible al Estudiante:</strong> Precio de venta de $50.00 MXN por una porci&oacute;n completa de 250 gramos, ofreciendo un excelente balance costo-beneficio.
                    </li>
                </ul>
            </div>
        </div>
    </div>
</div>

<!-- ========================================== -->
<!-- PÁGINA 4: DIAPOSITIVA 3 (PUNTO 3)          -->
<!-- ========================================== -->
<div class="slide">
    <div class="slide-header">
        <div class="slide-title">3. Mercado Objetivo</div>
        <div class="slide-meta">
            <span>An&aacute;lisis del plan de negocio</span>
        </div>
    </div>

    <div class="slide-body">
        <div style="display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 50px; height: 100%;">
            <!-- Left Column: Segmentación y Datos -->
            <div>
                <h3 class="section-title">Segmentaci&oacute;n y Hallazgos de Encuesta (N = 27)</h3>
                <ul class="classic-list">
                    <li>
                        <strong>P&uacute;blico Objetivo Principal:</strong> J&oacute;venes de 18 a 22 a&ntilde;os (representan el <strong>62.96%</strong> de los encuestados), que cursan ingenier&iacute;as y carreras t&eacute;cnicas en la UTM.
                    </li>
                    <li>
                        <strong>Mercado Secundario:</strong> Personal docente y administrativo de 23 a 30+ a&ntilde;os (37.04%) que busca colaciones ligeras e higi&eacute;nicas durante su jornada de trabajo.
                    </li>
                    <li>
                        <strong>H&aacute;bito de Consumo Saludable:</strong> El <strong>88.89%</strong> de los encuestados afirm&oacute; consumir opciones saludables (como yogurt, fruta o avena) "frecuentemente" o "a veces".
                    </li>
                    <li>
                        <strong>Alta Intenci&oacute;n de Compra:</strong> El <strong>85.19%</strong> comprar&iacute;a el vaso preparado de yogurt griego (48.15% "Definitivamente" y 37.04% "Probablemente").
                    </li>
                    <li>
                        <strong>Validaci&oacute;n del Precio:</strong> El <strong>66.67%</strong> considera que $50.00 MXN es un precio accesible y justo, y un 25.93% adicional lo comprar&iacute;a con promociones de paquete.
                    </li>
                    <li>
                        <strong>Preferencia de Entrega:</strong> El <strong>44.44%</strong> prefiere entrega directa a su aula u oficina, mientras que el <strong>37.04%</strong> prefiere pedirlo v&iacute;a redes sociales (WhatsApp/FB).
                    </li>
                </ul>
            </div>

            <!-- Right Column: Imagen y Análisis -->
            <div style="display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <h3 class="section-title">Validaci&oacute;n Emp&iacute;rica de Demanda</h3>
                    <div style="text-align: center; border: 1px solid #D1D5DB; padding: 12px; background-color: #FFFFFF;">
                        <img src="{b64_survey_intent}" style="width: 100%; max-height: 290px; object-fit: contain;" alt="Gráfica de Encuesta - Intención de Compra" />
                        <div style="font-size: 15px; color: #4B5563; margin-top: 10px; font-style: italic;">
                            Gr&aacute;fica 1. Aceptaci&oacute;n del producto en la UTM: 85.19% de respuestas positivas.
                        </div>
                    </div>
                </div>

                <div style="margin-top: 20px; font-size: 18px; color: #2D3748; line-height: 1.5;">
                    <strong>Estrategia de Volumen:</strong> El <strong>77.78%</strong> de los encuestados confirm&oacute; que aprovechar&iacute;a la promoci&oacute;n de <strong>3 vasos por $135.00 MXN</strong> ($45.00 c/u) para compartir con compa&ntilde;eros.
                </div>
            </div>
        </div>
    </div>
</div>

<!-- ========================================== -->
<!-- PÁGINA 5: DIAPOSITIVA 4 (PUNTO 4)          -->
<!-- ========================================== -->
<div class="slide">
    <div class="slide-header">
        <div class="slide-title">4. Propuesta de Valor</div>
        <div class="slide-meta">
            <span>An&aacute;lisis del plan de negocio</span>
        </div>
    </div>

    <div class="slide-body">
        <div style="margin-bottom: 22px;">
            <p style="font-size: 20px; color: #1E3A5F; font-weight: bold; line-height: 1.45;">
                Propuesta de Valor Central:
            </p>
            <p style="font-size: 19px; color: #374151; margin-top: 4px; line-height: 1.5;">
                "Venta de vasos con yogurt griego natural, granola crujiente y frutos rojos frescos, con cuchara incluida: una opci&oacute;n saludable, fresca y lista para llevar a un precio justo para estudiantes y trabajadores."
            </p>
        </div>

        <h3 class="section-title">An&aacute;lisis Comparativo de Competencia</h3>
        <table class="classic-table" style="margin-bottom: 24px;">
            <thead>
                <tr>
                    <th style="width: 20%;">Criterio / Caracter&iacute;stica</th>
                    <th style="width: 28%; background-color: #2D5A27;">Vasos "Vida Verde" (Tu Producto)</th>
                    <th style="width: 26%;">Tiendas y Supermercados</th>
                    <th style="width: 26%;">Puestos de Comida Escolar</th>
                </tr>
            </thead>
            <tbody>
                <tr class="highlight-row">
                    <td><strong>Frescura</strong></td>
                    <td><strong>Alta:</strong> Preparaci&oacute;n al d&iacute;a (6:00 AM). Cero inventario rezagado.</td>
                    <td><strong>Baja:</strong> Productos empacados industrialmente semanas antes.</td>
                    <td><strong>Variable:</strong> Comida frita o recalentada por lotes.</td>
                </tr>
                <tr>
                    <td><strong>Calidad Saludable</strong></td>
                    <td><strong>S&iacute; (Sin conservadores):</strong> Alto en prote&iacute;na l&aacute;ctea, sin qu&iacute;micos artificiales.</td>
                    <td><strong>Variable:</strong> Con jarabes de alta fructosa y conservadores qu&iacute;micos.</td>
                    <td><strong>Baja:</strong> Pocas opciones saludables, predominio de grasas saturadas.</td>
                </tr>
                <tr class="highlight-row">
                    <td><strong>Practicidad</strong></td>
                    <td><strong>Alta:</strong> Vaso listo para llevar, incluye cuchara individual sellada.</td>
                    <td><strong>Media:</strong> Normalmente no incluyen cuchara ni fruta del d&iacute;a.</td>
                    <td><strong>Media:</strong> Requiere tiempo para sentarse a comer o platos abiertos.</td>
                </tr>
                <tr>
                    <td><strong>Porciones</strong></td>
                    <td><strong>Estandarizadas:</strong> 250 g pesados por b&aacute;scula digital.</td>
                    <td>Empaques de f&aacute;brica reducidos (150 g a 180 g).</td>
                    <td>Porciones variables seg&uacute;n el vendedor.</td>
                </tr>
                <tr class="highlight-row">
                    <td><strong>Precio al P&uacute;blico</strong></td>
                    <td><strong>$50.00 MXN</strong> (Excelente relaci&oacute;n calidad-precio).</td>
                    <td>$55.00 a $75.00 MXN en cafeter&iacute;as y tiendas de conveniencia.</td>
                    <td>$45.00 a $65.00 MXN por platillos pesados o frituras.</td>
                </tr>
            </tbody>
        </table>

        <ul class="classic-list" style="gap: 10px;">
            <li><strong>Diferenciaci&oacute;n Principal:</strong> Elaboraci&oacute;n matutina artesanal y entrega directa en el aula, eliminando tiempos muertos y filas para el estudiante.</li>
        </ul>
    </div>
</div>

<!-- ========================================== -->
<!-- PÁGINA 6: DIAPOSITIVA 5 (PUNTO 5)          -->
<!-- ========================================== -->
<div class="slide">
    <div class="slide-header">
        <div class="slide-title">5. Viabilidad del Negocio</div>
        <div class="slide-meta">
            <span>An&aacute;lisis del plan de negocio</span>
        </div>
    </div>

    <div class="slide-body">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 50px; height: 100%;">
            <!-- Costos de Producción -->
            <div>
                <h3 class="section-title">Inversi&oacute;n Inicial y Costos Unitarios</h3>
                <div style="font-size: 19px; color: #1E3A5F; font-weight: bold; margin-bottom: 12px;">
                    Inversi&oacute;n Inicial Total: $422.00 MXN (Riesgo Financiero M&iacute;nimo)
                </div>

                <table class="classic-table" style="margin-bottom: 20px;">
                    <thead>
                        <tr>
                            <th>Insumo / Concepto</th>
                            <th>Precio Compra / Rendimiento</th>
                            <th>Costo por Vaso</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Yogurt Griego Yoplait</td>
                            <td>$92.90 / 2 botes (rinde ~6 vasos)</td>
                            <td>$7.74 MXN</td>
                        </tr>
                        <tr>
                            <td>Granola con Ar&aacute;ndanos</td>
                            <td>$75.00 bolsa granel (rinde ~10 vasos)</td>
                            <td>$7.50 MXN</td>
                        </tr>
                        <tr>
                            <td>Frutos Rojos Congelados</td>
                            <td>$73.90 bolsa mixta (rinde ~8 vasos)</td>
                            <td>$9.24 MXN</td>
                        </tr>
                        <tr>
                            <td>Vaso con tapa domo + cuchara</td>
                            <td>Paquete mayoreo ($150 vasos + $30 etiq.)</td>
                            <td>$4.00 MXN</td>
                        </tr>
                        <tr class="highlight-row">
                            <td colspan="2"><strong>COSTO REAL POR CADA VASO</strong></td>
                            <td><strong>$28.48 MXN</strong></td>
                        </tr>
                    </tbody>
                </table>

                <ul class="classic-list">
                    <li>Gastos diarios: Recompra &aacute;gil de insumos y empaques conforme a la venta real.</li>
                </ul>
            </div>

            <!-- Proyección y Punto de Equilibrio -->
            <div>
                <h3 class="section-title">Ventas, Ingresos y Punto de Equilibrio</h3>
                <table class="classic-table" style="margin-bottom: 20px;">
                    <thead>
                        <tr>
                            <th>Concepto Financiero</th>
                            <th>Monto / Meta</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Precio de Venta Sugerido</td>
                            <td><strong>$50.00 MXN</strong></td>
                        </tr>
                        <tr>
                            <td>Margen de Ganancia Bruta por Vaso</td>
                            <td><strong>$21.52 MXN (43.04%)</strong></td>
                        </tr>
                        <tr>
                            <td>Meta de Venta Diaria</td>
                            <td><strong>15 vasos / d&iacute;a</strong></td>
                        </tr>
                        <tr>
                            <td>Ingreso Diario Bruto (15 &times; $50)</td>
                            <td>$750.00 MXN</td>
                        </tr>
                        <tr class="highlight-row">
                            <td><strong>Ganancia Neta Diaria</strong></td>
                            <td><strong>$322.80 MXN</strong></td>
                        </tr>
                    </tbody>
                </table>

                <ul class="classic-list">
                    <li>
                        <strong>Punto de Equilibrio:</strong> Gastos fijos estimados: $150.00/d&iacute;a. $150 &divide; $21.52 = <strong>7 vasos al d&iacute;a</strong> para no perder. Todo lo que pase de 7 vasos es ganancia neta.
                    </li>
                    <li>
                        <strong>Evaluaci&oacute;n Financiera:</strong> <strong>S&Iacute; ES RENTABLE</strong>. Con inversi&oacute;n baja, se recupera en 1–2 d&iacute;as vendiendo 15 vasos al d&iacute;a.
                    </li>
                </ul>
            </div>
        </div>
    </div>
</div>

<!-- ========================================== -->
<!-- PÁGINA 7: DIAPOSITIVA 6 (PUNTOS 6 Y 7)     -->
<!-- ========================================== -->
<div class="slide">
    <div class="slide-header">
        <div class="slide-title">6 y 7. Descripci&oacute;n del Producto y Especificaciones T&eacute;cnicas</div>
        <div class="slide-meta">
            <span>Dise&ntilde;o del producto</span>
        </div>
    </div>

    <div class="slide-body">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 50px; height: 100%;">
            <!-- Punto 6: Descripción y Funcionamiento -->
            <div>
                <h3 class="section-title">6. Descripci&oacute;n, Funcionamiento y Usos</h3>
                <ul class="classic-list" style="margin-bottom: 22px;">
                    <li>
                        <strong>Descripci&oacute;n General:</strong> Vaso troncoc&oacute;nico transparente que contiene capas visibles de yogurt griego, granola crujiente y frutos rojos frescos, dise&ntilde;ado para consumo inmediato.
                    </li>
                    <li>
                        <strong>Funcionamiento:</strong> Producto listo para consumir ("Ready to Eat"). Su tapa domo herm&eacute;tica previene derrames durante traslados a pie y retiene la frescura sin necesidad de cubiertos externos.
                    </li>
                    <li>
                        <strong>Momentos de Consumo:</strong> Ideal como desayuno r&aacute;pido para clases matutinas (7:00 AM) o colaci&oacute;n entre jornadas de estudio prolongadas.
                    </li>
                    <li>
                        <strong>Condiciones de Conservaci&oacute;n:</strong> Refrigeraci&oacute;n continua entre 2 &deg;C y 4 &deg;C. Transporte en hielera t&eacute;rmica a menos de 7 &deg;C. Vida &uacute;til de 48 horas sin perder textura.
                    </li>
                </ul>
            </div>

            <!-- Punto 7: Especificaciones Técnicas -->
            <div>
                <h3 class="section-title">7. Ficha T&eacute;cnica y Balance de Materia</h3>
                <table class="classic-table" style="margin-bottom: 18px;">
                    <thead>
                        <tr>
                            <th style="width: 45%;">Par&aacute;metro T&eacute;cnico</th>
                            <th style="width: 55%;">Especificaci&oacute;n F&iacute;sica</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Capacidad Volum&eacute;trica</strong></td>
                            <td>12 onzas l&iacute;quidas (355 ml aprox.)</td>
                        </tr>
                        <tr class="highlight-row">
                            <td><strong>Peso Neto Total</strong></td>
                            <td><strong>250 gramos</strong> (&plusmn; 5 g tolerancia)</td>
                        </tr>
                        <tr>
                            <td><strong>Dimensiones Externas</strong></td>
                            <td>Altura: 135 mm | Boca: 92 mm | Base: 58 mm</td>
                        </tr>
                        <tr>
                            <td><strong>Tipo de Cierre y Utensilio</strong></td>
                            <td>Tapa domo herm&eacute;tica + cuchara sellada adherida</td>
                        </tr>
                    </tbody>
                </table>

                <table class="classic-table">
                    <thead>
                        <tr>
                            <th>Componente</th>
                            <th>Masa (g)</th>
                            <th>Porcentaje (%)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Yogurt Griego Natural</td>
                            <td>150 g</td>
                            <td>60.0%</td>
                        </tr>
                        <tr>
                            <td>Frutos Rojos Mixtos</td>
                            <td>60 g</td>
                            <td>24.0%</td>
                        </tr>
                        <tr>
                            <td>Granola con Ar&aacute;ndanos</td>
                            <td>40 g</td>
                            <td>16.0%</td>
                        </tr>
                        <tr class="highlight-row">
                            <td><strong>Contenido Neto Total</strong></td>
                            <td><strong>250 g</strong></td>
                            <td><strong>100.0%</strong></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>

<!-- ========================================== -->
<!-- PÁGINA 8: DIAPOSITIVA 7 (PUNTO 8)          -->
<!-- ========================================== -->
<div class="slide">
    <div class="slide-header">
        <div class="slide-title">8. Selecci&oacute;n de Materiales y Justificaci&oacute;n</div>
        <div class="slide-meta">
            <span>Dise&ntilde;o del producto</span>
        </div>
    </div>

    <div class="slide-body">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 50px; height: 100%;">
            <!-- Insumos Columna 1 -->
            <div>
                <h3 class="section-title">1. Yogurt Griego Natural (Yoplait / Lala)</h3>
                <ul class="classic-list" style="margin-bottom: 28px;">
                    <li><strong>Justificaci&oacute;n Nutricional:</strong> Aporte concentrado de prote&iacute;nas l&aacute;cteas (10-12 g por porci&oacute;n) que brinda saciedad prolongada y energ&iacute;a constante sin provocar somnolencia ni pesadez digestiva.</li>
                    <li><strong>Justificaci&oacute;n F&iacute;sica:</strong> Su alta viscosidad y textura densa evitan el colapso de las capas superiores y retrasan la absorci&oacute;n de humedad hacia la granola.</li>
                    <li><strong>Calidad:</strong> Base pura sin az&uacute;cares refinados a&ntilde;adidos.</li>
                </ul>

                <h3 class="section-title">3. Frutos Rojos Congelados (Tecnolog&iacute;a IQF)</h3>
                <ul class="classic-list">
                    <li><strong>Tecnolog&iacute;a IQF (Individual Quick Freezing):</strong> Congelaci&oacute;n ultrarr&aacute;pida que evita la formaci&oacute;n de macrocristales de hielo, reteniendo jugos, textura y nutrientes de las fresas, ar&aacute;ndanos y moras.</li>
                    <li><strong>Nutrici&oacute;n y Salud:</strong> Fuente rica en antioxidantes (antocianinas) y vitamina C, sin necesidad de alm&iacute;bares azucarados.</li>
                    <li><strong>Atractivo Visual:</strong> Corona de vivos colores naturales.</li>
                </ul>
            </div>

            <!-- Insumos Columna 2 -->
            <div>
                <h3 class="section-title">2. Granola Horneada con Ar&aacute;ndanos</h3>
                <ul class="classic-list" style="margin-bottom: 28px;">
                    <li><strong>Justificaci&oacute;n Nutricional:</strong> Avena integral tostada, miel, semillas y ar&aacute;ndanos. Provee carbohidratos complejos de absorci&oacute;n lenta y fibra para mantener energ&iacute;a sostenida durante la jornada.</li>
                    <li><strong>Justificaci&oacute;n Mec&aacute;nica:</strong> El horneado seco confiere una barrera natural que preserva la textura crujiente ("crunch") incluso en contacto con el yogurt.</li>
                    <li><strong>Sabor:</strong> Equilibra la acidez l&aacute;ctea del yogurt.</li>
                </ul>

                <h3 class="section-title">4. Envase PET Cristal y Cuchara Sellada (12 oz)</h3>
                <ul class="classic-list">
                    <li><strong>Transparencia &Oacute;ptica:</strong> Polietileno tereftalato (PET C&oacute;digo 1) grado alimenticio que exhibe con total nitidez las capas limpias del producto, reforzando la percepci&oacute;n de frescura e higiene.</li>
                    <li><strong>Hermeticidad:</strong> Tapa domo a presi&oacute;n que previene derrames durante traslados; cuchara pl&aacute;stica envuelta individualmente de f&aacute;brica.</li>
                    <li><strong>Reciclabilidad:</strong> Material 100% reciclable en centros de acopio.</li>
                </ul>
            </div>
        </div>
    </div>
</div>

<!-- ========================================== -->
<!-- PÁGINA 9: DIAPOSITIVA 8 (PUNTO 9)          -->
<!-- ========================================== -->
<div class="slide">
    <div class="slide-header">
        <div class="slide-title">9. Dise&ntilde;o y Desarrollo (Boceto, Prototipo y Componentes)</div>
        <div class="slide-meta">
            <span>Dise&ntilde;o del producto</span>
        </div>
    </div>

    <div class="slide-body">
        <div style="display: grid; grid-template-columns: 1fr 0.95fr 1.05fr; gap: 35px; height: 100%;">
            <!-- Columna 1: Boceto Técnico Acotado -->
            <div style="display: flex; flex-direction: column; justify-content: flex-start;">
                <h3 class="section-title">Boceto y Plano T&eacute;cnico Acotado</h3>
                <div style="border: 1px solid #CBD5E1; padding: 10px; background: #FFFFFF; text-align: center; margin-bottom: 12px;">
                    {svg_blueprint}
                    <div style="font-size: 14px; color: #4B5563; margin-top: 8px; font-style: italic;">
                        Figura 1. Boceto t&eacute;cnico del envase con cotas y balance por capas (12 oz / 250 g).
                    </div>
                </div>
            </div>

            <!-- Columna 2: Prototipo Físico Real -->
            <div style="display: flex; flex-direction: column; justify-content: flex-start;">
                <h3 class="section-title">Prototipo F&iacute;sico Terminado</h3>
                <div style="border: 1px solid #CBD5E1; padding: 10px; background: #FFFFFF; text-align: center; margin-bottom: 12px;">
                    <img src="{b64_photo}" style="width: 100%; height: 340px; object-fit: cover;" alt="Prototipo Físico Vida Verde" />
                    <div style="font-size: 14px; color: #4B5563; margin-top: 8px; font-style: italic;">
                        Figura 2. Prototipo f&iacute;sico real de los vasos preparados para venta en la UTM.
                    </div>
                </div>
                <ul class="classic-list" style="gap: 8px;">
                    <li style="font-size: 16px; line-height: 1.45;"><strong>Validaci&oacute;n F&iacute;sica:</strong> Pruebas reales de transporte en fr&iacute;o, hermeticidad de tapa domo y textura crujiente garantizada.</li>
                </ul>
            </div>

            <!-- Columna 3: Desglose de Componentes -->
            <div>
                <h3 class="section-title">Desglose de Componentes F&iacute;sicos</h3>
                <ul class="classic-list" style="gap: 12px;">
                    <li style="font-size: 16px; line-height: 1.45;">
                        <strong>1. Base de Yogurt Griego (150 g / 60%):</strong> Capa inferior densa que aporta el soporte estructural del alimento y la carga proteica principal (10-12 g).
                    </li>
                    <li style="font-size: 16px; line-height: 1.45;">
                        <strong>2. Capa de Granola Crujiente (40 g / 16%):</strong> Cereal horneado con ar&aacute;ndanos colocado estrat&eacute;gicamente para conservar su textura ("crunch") sin humedecerse.
                    </li>
                    <li style="font-size: 16px; line-height: 1.45;">
                        <strong>3. Corona de Frutos Rojos (60 g / 24%):</strong> Fresa rebanada, mora y ar&aacute;ndano entero con antioxidantes naturales y balance &aacute;cido-dulce.
                    </li>
                    <li style="font-size: 16px; line-height: 1.45;">
                        <strong>4. Envase PET Grado Alimenticio:</strong> Vaso troncoc&oacute;nico de 12 oz con nervaduras de rigidez y tapa domo a presi&oacute;n sin orificio para sellado herm&eacute;tico antifugas.
                    </li>
                    <li style="font-size: 16px; line-height: 1.45;">
                        <strong>5. Utensilio y Marca Oficial:</strong> Cuchara pl&aacute;stica envuelta individualmente adherida exteriormente y etiqueta circular autoadherible de 5 cm.
                    </li>
                </ul>
            </div>
        </div>
    </div>
</div>

<!-- ========================================== -->
<!-- PÁGINA 10: DIAPOSITIVA 9 (PUNTO 10)        -->
<!-- ========================================== -->
<div class="slide">
    <div class="slide-header">
        <div class="slide-title">10. Calidad y Sustentabilidad</div>
        <div class="slide-meta">
            <span>Dise&ntilde;o del producto</span>
        </div>
    </div>

    <div class="slide-body">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 50px; height: 100%;">
            <!-- Calidad -->
            <div>
                <h3 class="section-title">Garant&iacute;a de Calidad y Criterios de Inspecci&oacute;n</h3>
                <ul class="classic-list" style="margin-bottom: 22px;">
                    <li>
                        <strong>Buenas Pr&aacute;cticas de Manufactura (BPM):</strong> Desinfecci&oacute;n de superficies a las 6:00 AM, lavado de manos quir&uacute;rgico, uso obligatorio de cofia, cubrebocas, mandil y guantes de nitrilo.
                    </li>
                    <li>
                        <strong>Inspecci&oacute;n de Yogurt:</strong> Aceptado con sello de aluminio &iacute;ntegro y caducidad lejana. Rechazado si el bote est&aacute; inflado, golpeado o presenta desuerado.
                    </li>
                    <li>
                        <strong>Inspecci&oacute;n de Fruta IQF:</strong> Aceptada si las bayas vienen sueltas al tacto. Rechazada si contiene bloques s&oacute;lidos de hielo (indicio de descongelaci&oacute;n previa).
                    </li>
                    <li>
                        <strong>Inspecci&oacute;n de Granola:</strong> Aceptada seca, dorada y crujiente en bolsa herm&eacute;tica. Rechazada si presenta humedad o apelmazamiento.
                    </li>
                    <li>
                        <strong>Inspecci&oacute;n de Envases:</strong> Aceptados limpios de f&aacute;brica. Rechazados si vienen abiertos, rayados o aplastados.
                    </li>
                </ul>
            </div>

            <!-- Sustentabilidad -->
            <div>
                <h3 class="section-title">Acciones de Sustentabilidad Ambiental</h3>
                <ul class="classic-list" style="margin-bottom: 24px;">
                    <li>
                        <strong>Etapa Actual (Arranque Responsable):</strong>
                        <br>&bull; Uso de recipientes y tapas de PET 100% reciclables (C&oacute;digo de identificaci&oacute;n 1).
                        <br>&bull; Promoci&oacute;n activa entre los consumidores para depositar el vaso en los contenedores de reciclaje de pl&aacute;stico del campus UTM.
                        <br>&bull; Ensamble bajo pedido y meta de 15 unidades diarias para lograr <strong>cero merma de alimentos</strong>.
                    </li>
                    <li>
                        <strong>Mejora a Mediano Plazo (Transici&oacute;n Verde):</strong>
                        <br>&bull; Sustituci&oacute;n del vaso PET por recipientes biodegradables y compostables a base de f&eacute;cula de ma&iacute;z (PLA).
                        <br>&bull; Cambio de cubiertos convencionales por cucharas elaboradas con resina de semilla de aguacate.
                        <br>&bull; Financiamiento de la transici&oacute;n ecol&oacute;gica mediante la reinversi&oacute;n de las ganancias diarias del negocio una vez estabilizado el volumen.
                    </li>
                </ul>
            </div>
        </div>
    </div>
</div>

<!-- ========================================== -->
<!-- PÁGINA 11: DIAPOSITIVA 10 (PUNTO 11)       -->
<!-- ========================================== -->
<div class="slide">
    <div class="slide-header">
        <div class="slide-title">11. Conclusi&oacute;n del Proyecto</div>
        <div class="slide-meta">
            <span>Conclusiones</span>
        </div>
    </div>

    <div class="slide-body">
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px; height: 100%;">
            <!-- Viabilidad -->
            <div>
                <h3 class="section-title">&iquest;Por qu&eacute; el Proyecto es Viable?</h3>
                <ul class="classic-list">
                    <li>
                        <strong>Inversi&oacute;n M&iacute;nima:</strong> Con solo <strong>$422.00 MXN</strong> es posible iniciar operaciones reales sin recurrir a cr&eacute;ditos ni deudas.
                    </li>
                    <li>
                        <strong>R&aacute;pida Amortizaci&oacute;n:</strong> El capital inicial se recupera &iacute;ntegramente en apenas <strong>1 a 2 d&iacute;as</strong> de venta.
                    </li>
                    <li>
                        <strong>Demanda Validada:</strong> El <strong>85.19%</strong> de la comunidad UTM encuestada demostr&oacute; una intenci&oacute;n de compra favorable.
                    </li>
                    <li>
                        <strong>Margen Atractivo:</strong> Ganancia neta de <strong>$21.52 MXN por vaso (43.04%)</strong>, generando m&aacute;s de $300 pesos diarios con solo 15 vasos.
                    </li>
                </ul>
            </div>

            <!-- Ventajas -->
            <div>
                <h3 class="section-title">Ventajas Competitivas Clave</h3>
                <ul class="classic-list">
                    <li>
                        <strong>Frescura del D&iacute;a:</strong> Ensamble matutino diario (6:00 AM) sin qu&iacute;micos ni conservadores; granola crujiente garantizada.
                    </li>
                    <li>
                        <strong>Comodidad en el Aula:</strong> Entrega directa en salones y por WhatsApp, eliminando las filas y tiempos de traslado del alumno.
                    </li>
                    <li>
                        <strong>Formato Todo Incluido:</strong> Vaso herm&eacute;tico ergon&oacute;mico con cubierto individual sellado, listo para consumir al paso.
                    </li>
                    <li>
                        <strong>Excelente Precio:</strong> $50.00 MXN frente a los $65.00 - $85.00 MXN de opciones comerciales externas.
                    </li>
                </ul>
            </div>

            <!-- Mejoras -->
            <div>
                <h3 class="section-title">Oportunidades de Mejora</h3>
                <ul class="classic-list">
                    <li>
                        <strong>Compras al Mayoreo:</strong> Adquisici&oacute;n de cubetas de yogurt y fruta en clubes de mayoreo (Sam's / Smart) para bajar el costo a &lt;$22 MXN y subir el margen.
                    </li>
                    <li>
                        <strong>Fruta de Temporada:</strong> Ediciones especiales con fruta regional econ&oacute;mica (mango, pl&aacute;tano) para abaratar costos en invierno.
                    </li>
                    <li>
                        <strong>Empaques Ecol&oacute;gicos:</strong> Migrar a vasos de f&eacute;cula de ma&iacute;z compostable y cubiertos de semilla de aguacate.
                    </li>
                    <li>
                        <strong>Expansi&oacute;n:</strong> Aumentar a 30 vasos diarios y abarcar otros edificios del campus UTM.
                    </li>
                </ul>
            </div>
        </div>

        <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid #D1D5DB; text-align: center; font-size: 19px; color: #166534; font-weight: bold;">
            Dictamen Final: El proyecto "Vida Verde" es una propuesta t&eacute;cnico-econ&oacute;mica 100% rentable, viable y con alto potencial de crecimiento en la UTM.
        </div>
    </div>
</div>

</body>
</html>
"""

html_path = os.path.abspath("presentacion_vida_verde_clasica.html")
with open(html_path, "w", encoding="utf-8") as f:
    f.write(html_content)

print(f"Classic presentation HTML saved to {html_path}")

desktop_dir = r"C:\Users\jorge\Desktop"
pdf_output_path = os.path.join(desktop_dir, "Presentacion_Plan_de_Negocio_Vida_Verde.pdf")

chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
cmd = [
    chrome_path,
    "--headless=new",
    "--disable-gpu",
    "--run-all-compositor-stages-before-draw",
    "--no-pdf-header-footer",
    f"--print-to-pdf={pdf_output_path}",
    html_path
]

print("Compiling classic PowerPoint-style PDF via Chrome...")
res = subprocess.run(cmd, capture_output=True, text=True)
print(f"Chrome return code: {res.returncode}")

if os.path.exists(pdf_output_path):
    print(f"SUCCESS: Classic PDF saved at {pdf_output_path}")
    doc = pymupdf.open(pdf_output_path)
    print(f"Total page count: {len(doc)}")
else:
    print(f"ERROR: PDF not found at {pdf_output_path}")
