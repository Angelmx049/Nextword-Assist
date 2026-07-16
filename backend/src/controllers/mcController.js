const db = require("../config/db");
const { mcRequestDto } = require("../dto/requestDtos");

const {
    Document,
    Packer,
    Paragraph,
    Table,
    TableRow,
    TableCell,
    TextRun,
    WidthType
} = require("docx");


/*
|--------------------------------------------------------------------------
| FUNCIÓN AUXILIAR
|--------------------------------------------------------------------------
| Obtiene el ID del usuario autenticado desde el token JWT.
| Se dejaron varias posibilidades para evitar problemas dependiendo
| de cómo esté construido actualmente verificarToken.
|--------------------------------------------------------------------------
*/
const obtenerIdUsuario = (req) => {
    return (
        req.usuario?.id_usuario ||
        req.usuario?.id ||
        req.user?.id_usuario ||
        req.user?.id ||
        null
    );
};


/*
|--------------------------------------------------------------------------
| FUNCIÓN AUXILIAR PARA CONSTRUIR FILTROS
|--------------------------------------------------------------------------
| Permite reutilizar los mismos filtros tanto para:
| - consultar registros
| - exportar registros
|--------------------------------------------------------------------------
*/
const construirFiltros = (operador, fecha) => {
    let condiciones = [];
    let valores = [];

    if (operador && operador.trim() !== "") {
        condiciones.push("operador LIKE ?");
        valores.push(`%${operador.trim()}%`);
    }

    if (fecha && fecha.trim() !== "") {
        condiciones.push("fecha = ?");
        valores.push(fecha.trim());
    }

    let where = "";

    if (condiciones.length > 0) {
        where = `WHERE ${condiciones.join(" AND ")}`;
    }

    return {
        where,
        valores
    };
};


/*
|--------------------------------------------------------------------------
| OBTENER TODOS LOS REGISTROS
|--------------------------------------------------------------------------
| También permite filtrar por:
| - operador
| - fecha
|
| Ejemplos:
| GET /api/mc
| GET /api/mc?operador=Juan
| GET /api/mc?fecha=2026-07-07
| GET /api/mc?operador=Juan&fecha=2026-07-07
|--------------------------------------------------------------------------
*/
const obtenerRegistrosMC = async (req, res) => {
    try {
        const { operador, fecha } = req.query;

        const { where, valores } = construirFiltros(
            operador,
            fecha
        );

        const consulta = `
            SELECT
                id_mc,
                DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
                TIME_FORMAT(hora, '%H:%i:%s') AS hora,
                mc,
                operador,
                observaciones,
                creado_por,
                fecha_creacion,
                fecha_actualizacion
            FROM mc_marcaciones
            ${where}
            ORDER BY fecha DESC, hora DESC
        `;

        const [registros] = await db.query(
            consulta,
            valores
        );

        return res.status(200).json({
            ok: true,
            total: registros.length,
            registros
        });

    } catch (error) {
        console.error(
            "Error al obtener registros MC:",
            error
        );

        return res.status(500).json({
            ok: false,
            mensaje: "Error al obtener los registros de MC"
        });
    }
};


/*
|--------------------------------------------------------------------------
| OBTENER UN REGISTRO POR ID
|--------------------------------------------------------------------------
| Se utilizará principalmente cuando el usuario quiera editar
| un registro específico.
|--------------------------------------------------------------------------
*/
const obtenerRegistroMCPorId = async (req, res) => {
    try {
        const { id } = req.params;

        const [registros] = await db.query(
            `
            SELECT
                id_mc,
                DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
                TIME_FORMAT(hora, '%H:%i:%s') AS hora,
                mc,
                operador,
                observaciones,
                creado_por,
                fecha_creacion,
                fecha_actualizacion
            FROM mc_marcaciones
            WHERE id_mc = ?
            `,
            [id]
        );

        if (registros.length === 0) {
            return res.status(404).json({
                ok: false,
                mensaje: "Registro MC no encontrado"
            });
        }

        return res.status(200).json({
            ok: true,
            registro: registros[0]
        });

    } catch (error) {
        console.error(
            "Error al obtener registro MC:",
            error
        );

        return res.status(500).json({
            ok: false,
            mensaje: "Error al obtener el registro MC"
        });
    }
};


/*
|--------------------------------------------------------------------------
| CREAR NUEVO REGISTRO
|--------------------------------------------------------------------------
| Campos obligatorios:
| - fecha
| - hora
| - mc
| - operador
| - observaciones
|
| La observación no puede estar vacía.
|--------------------------------------------------------------------------
*/
const crearRegistroMC = async (req, res) => {
    try {
        const {
            fecha,
            hora,
            mc,
            operador,
            observaciones
        } = mcRequestDto(req.body);

        const idUsuario = obtenerIdUsuario(req);

        if (
            !fecha ||
            !hora ||
            !mc ||
            !operador ||
            !observaciones
        ) {
            return res.status(400).json({
                ok: false,
                mensaje:
                    "Fecha, hora, MC, operador y observaciones son obligatorios"
            });
        }

        if (String(mc).trim() === "") {
            return res.status(400).json({
                ok: false,
                mensaje: "El campo MC es obligatorio"
            });
        }

        if (operador.trim() === "") {
            return res.status(400).json({
                ok: false,
                mensaje: "El operador es obligatorio"
            });
        }

        if (observaciones.trim() === "") {
            return res.status(400).json({
                ok: false,
                mensaje: "La observación es obligatoria"
            });
        }

        if (!idUsuario) {
            return res.status(401).json({
                ok: false,
                mensaje:
                    "No se pudo identificar al usuario autenticado"
            });
        }

        const [resultado] = await db.query(
            `
            INSERT INTO mc_marcaciones (
                fecha,
                hora,
                mc,
                operador,
                observaciones,
                creado_por
            )
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
                fecha,
                hora,
                String(mc).trim(),
                operador.trim(),
                observaciones.trim(),
                idUsuario
            ]
        );

        const [nuevoRegistro] = await db.query(
            `
            SELECT
                id_mc,
                DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
                TIME_FORMAT(hora, '%H:%i:%s') AS hora,
                mc,
                operador,
                observaciones,
                creado_por,
                fecha_creacion,
                fecha_actualizacion
            FROM mc_marcaciones
            WHERE id_mc = ?
            `,
            [resultado.insertId]
        );

        return res.status(201).json({
            ok: true,
            mensaje: "Registro MC creado correctamente",
            registro: nuevoRegistro[0]
        });

    } catch (error) {
        console.error(
            "Error al crear registro MC:",
            error
        );

        return res.status(500).json({
            ok: false,
            mensaje: "Error al crear el registro MC"
        });
    }
};


/*
|--------------------------------------------------------------------------
| ACTUALIZAR REGISTRO
|--------------------------------------------------------------------------
| Permite modificar:
| - fecha
| - hora
| - mc
| - operador
| - observaciones
|
| Todos continúan siendo obligatorios.
|--------------------------------------------------------------------------
*/
const actualizarRegistroMC = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            fecha,
            hora,
            mc,
            operador,
            observaciones
        } = mcRequestDto(req.body);

        if (
            !fecha ||
            !hora ||
            !mc ||
            !operador ||
            !observaciones
        ) {
            return res.status(400).json({
                ok: false,
                mensaje:
                    "Fecha, hora, MC, operador y observaciones son obligatorios"
            });
        }

        if (String(mc).trim() === "") {
            return res.status(400).json({
                ok: false,
                mensaje: "El campo MC es obligatorio"
            });
        }

        if (operador.trim() === "") {
            return res.status(400).json({
                ok: false,
                mensaje: "El operador es obligatorio"
            });
        }

        if (observaciones.trim() === "") {
            return res.status(400).json({
                ok: false,
                mensaje: "La observación es obligatoria"
            });
        }

        const [existe] = await db.query(
            `
            SELECT id_mc
            FROM mc_marcaciones
            WHERE id_mc = ?
            `,
            [id]
        );

        if (existe.length === 0) {
            return res.status(404).json({
                ok: false,
                mensaje: "Registro MC no encontrado"
            });
        }

        await db.query(
            `
            UPDATE mc_marcaciones
            SET
                fecha = ?,
                hora = ?,
                mc = ?,
                operador = ?,
                observaciones = ?
            WHERE id_mc = ?
            `,
            [
                fecha,
                hora,
                String(mc).trim(),
                operador.trim(),
                observaciones.trim(),
                id
            ]
        );

        const [registroActualizado] = await db.query(
            `
            SELECT
                id_mc,
                DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
                TIME_FORMAT(hora, '%H:%i:%s') AS hora,
                mc,
                operador,
                observaciones,
                creado_por,
                fecha_creacion,
                fecha_actualizacion
            FROM mc_marcaciones
            WHERE id_mc = ?
            `,
            [id]
        );

        return res.status(200).json({
            ok: true,
            mensaje: "Registro MC actualizado correctamente",
            registro: registroActualizado[0]
        });

    } catch (error) {
        console.error(
            "Error al actualizar registro MC:",
            error
        );

        return res.status(500).json({
            ok: false,
            mensaje: "Error al actualizar el registro MC"
        });
    }
};


/*
|--------------------------------------------------------------------------
| ELIMINAR REGISTRO
|--------------------------------------------------------------------------
| Elimina el registro seleccionado.
|--------------------------------------------------------------------------
*/
const eliminarRegistroMC = async (req, res) => {
    try {
        const { id } = req.params;

        const [resultado] = await db.query(
            `
            DELETE FROM mc_marcaciones
            WHERE id_mc = ?
            `,
            [id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                ok: false,
                mensaje: "Registro MC no encontrado"
            });
        }

        return res.status(200).json({
            ok: true,
            mensaje: "Registro MC eliminado correctamente"
        });

    } catch (error) {
        console.error(
            "Error al eliminar registro MC:",
            error
        );

        return res.status(500).json({
            ok: false,
            mensaje: "Error al eliminar el registro MC"
        });
    }
};


/*
|--------------------------------------------------------------------------
| EXPORTAR REGISTROS A WORD
|--------------------------------------------------------------------------
| Respeta los filtros:
| - operador
| - fecha
|
| Ejemplos:
| GET /api/mc/exportar
| GET /api/mc/exportar?operador=Juan
| GET /api/mc/exportar?fecha=2026-07-07
|--------------------------------------------------------------------------
*/
const exportarRegistrosMC = async (req, res) => {
    try {
        const { operador, fecha } = req.query;

        const { where, valores } = construirFiltros(
            operador,
            fecha
        );

        const [registros] = await db.query(
            `
            SELECT
                DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
                TIME_FORMAT(hora, '%H:%i:%s') AS hora,
                mc,
                operador,
                observaciones
            FROM mc_marcaciones
            ${where}
            ORDER BY fecha DESC, hora DESC
            `,
            valores
        );

        if (registros.length === 0) {
            return res.status(404).json({
                ok: false,
                mensaje:
                    "No existen registros para exportar con los filtros seleccionados"
            });
        }

        const filas = [
            new TableRow({
                children: [
                    crearCeldaEncabezado("Fecha"),
                    crearCeldaEncabezado("Hora"),
                    crearCeldaEncabezado("MC"),
                    crearCeldaEncabezado("Operador"),
                    crearCeldaEncabezado("Observaciones")
                ]
            }),

            ...registros.map((registro) =>
                new TableRow({
                    children: [
                        crearCelda(registro.fecha),
                        crearCelda(registro.hora),
                        crearCelda(registro.mc),
                        crearCelda(registro.operador),
                        crearCelda(registro.observaciones)
                    ]
                })
            )
        ];

        const documento = new Document({
            sections: [
                {
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: "Reporte de Registros MC",
                                    bold: true,
                                    size: 32
                                })
                            ]
                        }),

                        new Paragraph({
                            text: ""
                        }),

                        new Paragraph({
                            text:
                                `Total de registros: ${registros.length}`
                        }),

                        new Paragraph({
                            text: ""
                        }),

                        new Table({
                            width: {
                                size: 100,
                                type: WidthType.PERCENTAGE
                            },
                            rows: filas
                        })
                    ]
                }
            ]
        });

        const buffer = await Packer.toBuffer(documento);

        const nombreArchivo =
            `reporte_mc_${Date.now()}.docx`;

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        );

        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${nombreArchivo}"`
        );

        return res.send(buffer);

    } catch (error) {
        console.error(
            "Error al exportar registros MC:",
            error
        );

        return res.status(500).json({
            ok: false,
            mensaje: "Error al exportar los registros MC"
        });
    }
};


/*
|--------------------------------------------------------------------------
| FUNCIONES AUXILIARES PARA WORD
|--------------------------------------------------------------------------
*/
const crearCeldaEncabezado = (texto) => {
    return new TableCell({
        children: [
            new Paragraph({
                children: [
                    new TextRun({
                        text: texto,
                        bold: true
                    })
                ]
            })
        ]
    });
};


const crearCelda = (texto) => {
    return new TableCell({
        children: [
            new Paragraph({
                text:
                    texto !== null &&
                    texto !== undefined
                        ? String(texto)
                        : ""
            })
        ]
    });
};


/*
|--------------------------------------------------------------------------
| EXPORTACIONES
|--------------------------------------------------------------------------
*/
module.exports = {
    obtenerRegistrosMC,
    obtenerRegistroMCPorId,
    crearRegistroMC,
    actualizarRegistroMC,
    eliminarRegistroMC,
    exportarRegistrosMC
};
