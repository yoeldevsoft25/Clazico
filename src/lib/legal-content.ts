import type { LegalPageContent } from '@/components/legal/legal-page';
import { STORE_INFO } from '@/lib/constants';

const updatedAt = '18 de junio de 2026';
const jurisdiction = 'República Bolivariana de Venezuela';

export const privacyPolicyContent: LegalPageContent = {
  eyebrow: 'Política legal de ecommerce',
  title: 'Políticas de privacidad',
  description:
    'Documento operativo de Clazico Store para explicar qué datos se solicitan, por qué se usan, con quién se comparten y cómo se protegen durante la navegación, compra, pago, despacho, garantía y atención postventa.',
  updatedAt,
  jurisdiction,
  sections: [
    {
      id: 'responsable',
      title: 'Responsable y alcance',
      body: [
        `Esta Política aplica a Clazico Store, tienda de calzado, ropa y accesorios con atención en ${STORE_INFO.address} y canales oficiales ${STORE_INFO.instagram}, ${STORE_INFO.instagramSport}, ${STORE_INFO.phone} y ${STORE_INFO.phone1}.`,
        'Al navegar, crear cuenta, solicitar información, comprar, enviar comprobantes de pago, coordinar entregas o pedir soporte, el cliente acepta el tratamiento de datos descrito aquí. Si el cliente no está de acuerdo, debe abstenerse de usar la tienda o de suministrar datos personales.',
      ],
      note: 'Esta política no sustituye asesoría legal personalizada y se interpreta conforme a normas venezolanas de orden público aplicables.',
    },
    {
      id: 'datos',
      title: 'Datos que podemos solicitar',
      bullets: [
        'Identificación y contacto: nombre, apellido, cédula o RIF cuando sea necesario, teléfono, WhatsApp, correo, usuario de redes sociales y datos de facturación.',
        'Datos de compra: productos vistos o agregados al carrito, tallas, colores, cantidades, preferencias, pedidos, fecha, precio, tasa aplicada, promociones, cupones y estado de pago.',
        'Datos de entrega: dirección, ciudad, estado, punto de referencia, persona autorizada para recibir, empresa de encomienda, agencia, guía, comprobante de entrega y evidencias fotográficas o de firma cuando apliquen.',
        'Datos de pago y verificación: banco emisor, referencia, captura, fecha, monto, moneda, titular, TxID, identificadores de Zelle, Binance, pago móvil, transferencia o cualquier medio usado. No solicitamos ni almacénamos claves bancarias, códigos de seguridad, PIN ni datos completos de tarjetas.',
        'Datos técnicos: dirección IP, navegador, dispositivo, cookies, registros de sesión, eventos de seguridad, errores, preferencias de idioma y datos necesarios para prevenir fraude o abuso.',
        'Datos postventa: reclamos, fotos, videos de unboxing, informes técnicos, conversaciones con soporte, decisiones de garantía, cambios, notas de crédito y acuerdos de solución.',
      ],
    },
    {
      id: 'finalidades',
      title: 'Finalidades del uso',
      bullets: [
        'Procesar pedidos, confirmar disponibilidad real, bloquear inventario, emitir comprobantes, coordinar pago, entrega, retiro en tienda o envío nacional.',
        'Verificar identidad, titularidad razonable del pago, legitimidad del comprobante, trazabilidad del despacho y prevención de contracargos, pagos reversados, fraude, suplantación o abuso de promociones.',
        'Gestionar cambios, garantías, reclamos, auditorías de inventario, conciliaciones contables, soporte, comunicaciones operativas y cumplimiento de obligaciones tributarias o comerciales.',
        'Mejorar catálogo, experiencia de navegación, seguridad, disponibilidad del sitio, detección de errores y medición de rendimiento sin vender bases de datos personales.',
        'Defender derechos de Clazico Store, documentar transacciones y conservar evidencias ante bancos, pasarelas, transportistas, autoridades, asesores o tribunales competentes.',
      ],
    },
    {
      id: 'base',
      title: 'Consentimiento y datos necesarios',
      body: [
        'El suministro de datos es voluntario, pero ciertos datos son indispensables para contratar, pagar, facturar, entregar, validar garantías o responder reclamos. Si el cliente omite, altera o entrega datos incompletos, Clazico Store puede suspender el pedido, cancelar la operación, exigir verificación adicional o rechazar solicitudes que no puedan evaluarse de forma segura.',
        'El cliente declara que la información suministrada es exacta, actual, verificable y propia, o que cuenta con autorización suficiente cuando entrega datos de un tercero autorizado para pagar, retirar o recibir el pedido.',
      ],
    },
    {
      id: 'terceros',
      title: 'Terceros y encargados',
      body: [
        'Podemos compartir datos estrictamente necesarios con bancos, operadores de pago, servicios de autenticación, proveedores tecnológicos, Velox POS, empresas de encomienda, motorizados, asesores contables o legales, autoridades competentes y personal autorizado de Clazico Store.',
        'Cuando el cliente elige una empresa de transporte, autoriza compartir los datos necesarios para crear la guía, ejecutar el despacho y atender incidencias. Las políticas del transportista también pueden aplicar al traslado, tiempos, cobertura, reclamos y seguros.',
      ],
      note: 'No vendemos datos personales. El acceso interno se limita a personal que lo necesita para operar la venta, proteger la tienda o cumplir obligaciones.',
    },
    {
      id: 'pagos',
      title: 'Pagos y comprobantes',
      body: [
        'Los comprobantes enviados por el cliente se usan para validar pagos, conciliar pedidos, prevenir fraudes y documentar la operación. La aprobación del pedido depende de que los fondos sean recibidos, acreditados y no reversados.',
        'Clazico Store puede conservar comprobantes, conversaciones y evidencias asociadas al pago durante el tiempo necesario para contabilidad, defensa de reclamos, garantías, auditorías o requerimientos de autoridad competente.',
      ],
    },
    {
      id: 'seguridad',
      title: 'Seguridad y límites',
      bullets: [
        'Aplicamos controles razonables de acceso, minimización, trazabilidad, respaldo y separación de datos según el rol operativo.',
        'Ningún sistema es infalible. El cliente debe proteger sus claves, dispositivos, sesiones, cuentas bancarias, correo y WhatsApp.',
        'Clazico Store nunca pedirá códigos OTP, claves bancarias, PIN, seed phrases, claves de Binance, contraseñas de correo o información equivalente.',
        'Si el cliente detecta suplantación, pago no reconocido, acceso indebido o uso irregular de su cuenta, debe notificarlo de inmediato por los canales oficiales.',
      ],
    },
    {
      id: 'conservación',
      title: 'Conservación de datos',
      body: [
        'Conservamos datos mientras exista relación comercial, pedidos pendientes, garantías vigentes, obligaciones contables, riesgos de fraude, controversias, auditorías, cumplimiento tributario o necesidad razonable de defensa legal.',
        'Cuando ya no sean necesarios, los datos pueden eliminarse, anonimizarse, bloquearse o conservarse solo en respaldo restringido según criterios técnicos y legales.',
      ],
    },
    {
      id: 'derechos',
      title: 'Derechos del titular',
      body: [
        `El titular puede solicitar acceso, actualización, rectificación o eliminación de datos incorrectos o tratados sin base legítima escribiendo a ${STORE_INFO.email} o a los WhatsApp oficiales. Clazico Store puede requerir verificación de identidad antes de responder.`,
        'La solicitud puede negarse o diferirse cuando exista obligación de conservar datos, pedidos abiertos, garantías, reclamos, deuda, investigación de fraude, defensa legal, mandato de autoridad o imposibilidad técnica razonable.',
      ],
    },
    {
      id: 'cookies',
      title: 'Cookies y medición',
      body: [
        'La tienda puede usar cookies, almacenamiento local y tecnologías similares para mantener sesión, recordar carrito, proteger contra abuso, medir rendimiento, mejorar navegación y habilitar funciones esenciales del ecommerce.',
        'El bloqueo de cookies puede limitar inicio de sesión, carrito, checkout, seguridad y experiencia de compra. Las preferencias del navegador son responsabilidad del cliente.',
      ],
    },
    {
      id: 'menores',
      title: 'Menores de edad',
      body: [
        'La tienda no esta dirigida a menores de edad. Las compras deben ser realizadas por personas con capacidad legal o por representantes autorizados. Si detectamos datos de un menor sin autorización, podremos limitar, cancelar o eliminar la cuenta o pedido.',
      ],
    },
    {
      id: 'cambios',
      title: 'Cambios de esta política',
      body: [
        'Clazico Store puede actualizar esta Política para reflejar cambios operativos, tecnológicos, legales, logísticos o de seguridad. La versión publicada en el sitio será la vigente desde su fecha de actualización, salvo que una norma imperativa disponga otra cosa.',
      ],
    },
  ],
  closing:
    'Privacidad en Clazico significa operar con datos suficientes para vender, cobrar, entregar y responder con trazabilidad, sin exponer información innecesaria y conservando evidencia razonable para proteger a la tienda y al cliente frente a fraude, errores o controversias.',
};

export const termsContent: LegalPageContent = {
  eyebrow: 'Contrato operativo de compra',
  title: 'Términos de uso',
  description:
    'Condiciones integrales para navegar, comprar, pagar, retirar, recibir productos, solicitar cambios y tramitar garantías en Clazico Store. Están redactadas para dar certeza al cliente y proteger a la tienda frente a escenarios ordinarios, complejos y de borde.',
  updatedAt,
  jurisdiction,
  sections: [
    {
      id: 'aceptacion',
      title: 'Aceptación y versión vigente',
      body: [
        'Al usar este sitio, escribir por canales oficiales, solicitar disponibilidad, pagar, retirar, recibir o conservar un producto, el cliente acepta estos Términos de Uso, la Política de Privacidad y las condiciones específicas informadas en el pedido, factura, comprobante, chat o publicación aplicable.',
        'La versión publicada en el sitio al momento de la compra regirá la operación, sin perjuicio de normas imperativas venezolanas. Si una cláusula se considera inválida, las demás conservaran vigencia en la máxima medida permitida.',
      ],
    },
    {
      id: 'tienda',
      title: 'Identidad y canales oficiales',
      body: [
        `Clazico Store opera desde ${STORE_INFO.address}. Los canales oficiales son ${STORE_INFO.instagram}, ${STORE_INFO.instagramSport}, ${STORE_INFO.phone}, ${STORE_INFO.phone1} y ${STORE_INFO.email}.`,
        'No nos hacemos responsables por pagos, reservas, promesas, descuentos, garantías o instrucciones emitidas por cuentas, revendedores, gestores, capturas, enlaces, perfiles o números no confirmados como oficiales por Clazico Store.',
      ],
    },
    {
      id: 'catalogo',
      title: 'Catálogo, disponibilidad y errores',
      bullets: [
        'El catálogo muestra inventario, precios, tallas, colores, imágenes y descripciones de referencia. La disponibilidad se confirma al validar pedido y pago.',
        'Las imágenes pueden variar por luz, pantalla, lote, edición, texturas, materiales, empaques, etiquetas o presentación del fabricante. Diferencias razonables no constituyen defecto.',
        'Clazico Store puede corregir errores tipográficos, de precio, stock, talla, descripción, categoría, tasa, promoción o imagen antes de confirmar definitivamente la venta.',
        'Si por error técnico, agotamiento, duplicidad de venta, daño de almacén, inconsistencia POS o causa ajena no podemos entregar el producto, podremos ofrecer reemplazo, saldo a favor o reembolso del monto efectivamente recibido.',
      ],
      note: 'La publicación de un producto no obliga a venderlo si existe error evidente, falta de pago validado, riesgo de fraude o imposibilidad real de entrega.',
    },
    {
      id: 'precios',
      title: 'Precios, moneda y tasa',
      body: [
        'Los precios pueden expresarse en USD, bolívares o equivalentes referenciales. Cuando el pago sea en bolívares, el monto se calculará con la tasa oficial aplicable informada para la fecha efectiva del pago, salvo condición expresa distinta permitida por la ley.',
        'Los precios no incluyen costos de delivery, encomienda, seguro, embalaje especial, comisiones de terceros, tributos extraordinarios o servicios adicionales, salvo que se indique expresamente.',
      ],
      bullets: [
        'Una cotización no pagada puede vencer, cambiar por tasa, stock, promoción o disponibilidad.',
        'Promociones, descuentos y cupones no son acumulables salvo confirmación expresa.',
        'Pagos incompletos, pagos con referencia incorrecta o pagos reversados no perfeccionan la compra.',
      ],
    },
    {
      id: 'pedido',
      title: 'Formación del pedido',
      body: [
        'El pedido pasa por etapas: solicitud, confirmación de disponibilidad, selección de entrega, pago, verificación, preparación, despacho o retiro, y cierre. La venta se considera confirmada solo cuando Clazico Store verifique el pago completo y confirme que el producto puede entregarse.',
        'Clazico Store puede rechazar o cancelar pedidos por datos incompletos, pagos no verificables, riesgo de fraude, abuso de promociones, inconsistencias de identidad, imposibilidad logística, errores manifiestos, incumplimiento de estos Términos o comportamiento abusivo contra el personal.',
      ],
    },
    {
      id: 'pagos',
      title: 'Pagos, abonos y fraude',
      bullets: [
        'El cliente debe pagar por los medios autorizados y enviar comprobante legible con monto, fecha, referencia, titular y número de pedido cuando aplique.',
        'El pedido no se libera hasta que el pago este acreditado, conciliado y no exista alerta razonable de reverso, contracargo, origen dudoso o inconsistencia.',
        'Si un pago es reversado, desconocido, retenido, reportado, impugnado o resultare fraudulento, la venta queda suspendida o resuelta, y Clazico Store podrá retener o recuperar el producto, bloquear la cuenta y exigir pago, gastos, daños y costos de cobranza.',
        'Los abonos para apartados, pedidos especiales o productos reservados pueden quedar sujetos a condiciones de vencimiento, retención administrativa o saldo a favor cuando el cliente cancela sin causa imputable a Clazico Store.',
        'No se aceptan capturas editadas, comprobantes reenviados sin trazabilidad, pagos de terceros sin verificación, ni instrucciones de pago fuera de canales oficiales.',
      ],
    },
    {
      id: 'entrega',
      title: 'Retiro, delivery y encomiendas',
      body: [
        'El cliente debe revisar producto, talla, color, cantidad, empaque y estado externo al recibir o retirar. La recepcion sin reserva razonable puede limitar reclamos posteriores por defectos visibles, faltantes o discrepancias evidentes.',
        'Cuando el envío se realiza por empresa de encomienda o delivery externo elegido o aceptado por el cliente, los tiempos, cobertura, extravíos, demoras, averías de transporte, seguros y reclamos operativos dependerán también de las políticas del transportista. Clazico Store colaborará con la gestión, pero no asume responsabilidad por hechos imputables exclusivamente al transportista o a datos incorrectos suministrados por el cliente.',
      ],
      bullets: [
        'El cliente debe suministrar dirección exacta, teléfono activo, cédula/RIF y datos de receptor autorizado.',
        'Reintentos, cambios de dirección, almacenaje, devoluciones por ausencia o datos errados pueden generar cargos adicionales.',
        'Si el cliente solicita envío sin seguro, cobertura limitada o modalidad económica, asume los riesgos propios de esa elección hasta el límite permitido por la ley.',
      ],
    },
    {
      id: 'revision',
      title: 'Revisión inmediata del producto',
      body: [
        'Para proteger la trazabilidad, recomendamos grabar el unboxing completo desde el paquete cerrado, sin cortes, mostrando guía, empaque, etiquetas, producto, talla y cualquier incidencia visible.',
        'Los reclamos por faltantes, producto equivocado, talla equivocada enviada por Clazico Store, golpe visible, empaque violentado o defecto aparente deben reportarse de inmediato y preferiblemente dentro de las 24 horas siguientes a la entrega. Mientras más tarde se reporte, más difícil será atribuir la incidencia al despacho original.',
      ],
      note: 'No aceptar paquetes violentados o con signos claros de manipulación sin dejar reserva ante el transportista fortalece cualquier reclamo.',
    },
    {
      id: 'cambios',
      title: 'Cambios por talla, modelo o preferencia',
      bullets: [
        'Los cambios por talla, modelo, color o preferencia del cliente no son automáticos: dependen de aprobación, disponibilidad, estado del producto y cumplimiento de estas condiciones.',
        'El plazo máximo para solicitar cambio es de tres (3) días continuos desde la entrega o retiro del producto.',
        'El producto debe estar nuevo, sin uso, sin olores, sin manchas, sin alteraciones, con etiquetas, accesorios, caja, empaque y factura o comprobante.',
        'Todo artículo devuelto queda sujeto a revisión física. Clazico Store puede rechazar el cambio si el producto no está en perfectas condiciones o si la revisión detecta uso, daño, alteración o falta de accesorios.',
        'Los costos de ida, vuelta, diferencia de precio, embalaje y comisiones asociadas al cambio por preferencia del cliente son por cuenta del cliente.',
        'No se cambian productos usados, lavados, alterados, personalizados, de liquidación final, con caja dañada por mal manejo del cliente, ropa interior, medias, productos de higiene, accesorios de contacto directo o artículos indicados como venta final, salvo defecto comprobado imputable a origen.',
        'Si no existe stock para cambio aprobado, Clazico Store podrá ofrecer saldo a favor, alternativa disponible o solución equivalente razonable.',
      ],
    },
    {
      id: 'garantia',
      title: 'Garantías ofrecidas',
      body: [
        'La garantía cubre defectos reales de fabricación o vicios ocultos que hagan el producto impropio para su uso ordinario o disminuyan sustancialmente su uso, evaluados según naturaleza del producto, marca, lote, tiempo, evidencia, modo de uso y condiciones de conservación.',
        'La garantía no cubre desgaste normal, comodidad subjetiva, elección incorrecta de talla, arrugas naturales, variaciones de color, daños por lavado, humedad, calor, químicos, uso deportivo indebido, golpes, raspaduras, mal almacenamiento, reparaciones externas, manipulación, uso intensivo, pérdida de accesorios, manchas, olores, deformaciones por uso o daños provocados por terceros.',
      ],
      bullets: [
        'El cliente debe presentar factura o comprobante, fotos y videos claros, descripción del caso y producto completo para evaluación.',
        'Clazico Store puede requerir inspección física, evaluación técnica, respuesta del proveedor o evidencia adicional antes de decidir.',
        'Las soluciones pueden incluir reparación, reposición, cambio, saldo a favor, ajuste comercial o reembolso, según corresponda legal y operativamente.',
        'La garantía del fabricante o importador, cuando exista, puede tener condiciones, plazos y exclusiones propias.',
      ],
      note: 'Ningúna garantía cubre daños originados después de la entrega por uso, accidente, negligencia, mantenimiento inadecuado o instrucciones incumplidas.',
    },
    {
      id: 'reembolsos',
      title: 'Reembolsos y saldos a favor',
      body: [
        'Los reembolsos proceden solo cuando Clazico Store lo apruebe o cuando resulte obligatorio conforme a ley aplicable. Antes de reembolsar, podremos verificar pago, identidad, titularidad, estado del producto, devolución efectiva, costos incurridos, comisiones no recuperables y ausencia de fraude.',
        'Cuando el cliente cancela por preferencia, demora imputable al transportista, error de datos, cambio de opinión, falta de retiro o decisión personal después de haberse preparado o reservado el producto, Clazico Store podrá ofrecer saldo a favor o aplicar deducciones razonables por costos directos ya causados, siempre que sea legalmente admisible.',
      ],
    },
    {
      id: 'uso',
      title: 'Uso permitido del sitio',
      bullets: [
        'El cliente no debe intentar vulnerar seguridad, automatizar compras abusivas, copiar catálogo masivamente, publicar datos falsos, suplantar identidad, cargar comprobantes falsos, interferir con inventario o explotar errores de precio o sistema.',
        'Clazico Store puede limitar acceso, cancelar pedidos, bloquear cuentas, conservar evidencia y ejercer acciones legales ante fraude, abuso, amenazas, difamación, extorsión, hostigamiento o uso indebido de la plataforma.',
      ],
    },
    {
      id: 'propiedad',
      title: 'Propiedad intelectual',
      body: [
        'El nombre Clazico, diseño del sitio, textos, fotografías propias, selección de catálogo, gráficos, logos, interfaces y contenido generado para la tienda pertenecen a Clazico Store o a sus respectivos titulares. No se autoriza copia, reventa de contenido, scraping, uso comercial no autorizado ni confusión con cuentas oficiales.',
      ],
    },
    {
      id: 'responsabilidad',
      title: 'Limitación de responsabilidad',
      body: [
        'En la máxima medida permitida por la ley, la responsabilidad de Clazico Store frente a una compra se limita al monto efectivamente pagado por el producto objeto del reclamo, excluyendo lucro cesante, daños indirectos, oportunidades pérdidas, expectativas comerciales, costos externos no autorizados o daños originados por terceros.',
        'No respondemos por fallas de internet, bancos, plataformas de pago, redes sociales, proveedores, transportistas, fuerza mayor, restricciones gubernamentales, fallas eléctricas, retrasos por clima, disturbios, controles, cierres, errores del cliente o eventos fuera de control razonable.',
      ],
    },
    {
      id: 'disputas',
      title: 'Reclamos, ley aplicable y jurisdicción',
      body: [
        'Antes de iniciar cualquier reclamo formal, el cliente debe contactar a Clazico Store por canales oficiales y aportar número de pedido, comprobante, evidencia y pretensión concreta para buscar una solución directa y documentada.',
        'Estos Términos se rigen por la legislación de la República Bolivariana de Venezuela. Salvo norma imperativa distinta, las partes procurarán resolver controversias de buena fe y, de ser necesario, ante las autoridades competentes de Maracaibo, estado Zulia, o las que correspondan conforme a la ley.',
      ],
    },
  ],
  closing:
    'Comprar en Clazico implica una operación documentada: precio confirmado, pago verificable, producto revisado, entrega trazable y garantía evaluada con evidencia. Estas reglas reducen ambigüedades y protegen a la tienda frente a abuso, fraude, errores logísticos y reclamos sin soporte.',
};




