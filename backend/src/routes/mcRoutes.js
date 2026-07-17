const express = require("express");

const router = express.Router();

const {
    obtenerRegistrosMC,
    obtenerRegistroMCPorId,
    crearRegistroMC,
    actualizarRegistroMC,
    eliminarRegistroMC,
    exportarRegistrosMC
} = require("../controllers/mcController");

const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

router.use(verificarToken);


router.get(
    "/",
    obtenerRegistrosMC
);


router.get(
    "/exportar",
    exportarRegistrosMC
);


router.get(
    "/:id",
    obtenerRegistroMCPorId
);

router.post(
    "/",
    crearRegistroMC
);

router.put(
    "/:id",
    actualizarRegistroMC
);


router.delete(
    "/:id",
    eliminarRegistroMC
);


module.exports = router;