-- Ejecutar manualmente antes de desplegar el código de notificaciones.
-- Migración aditiva: no elimina ni transforma notificaciones_alertas.
CREATE TABLE IF NOT EXISTS notificaciones (
  id_notificacion BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_tarea INT NOT NULL,
  destinatario_id INT NOT NULL,
  tipo ENUM(
    'VENCIMIENTO_30',
    'VENCIMIENTO_20',
    'VENCIMIENTO_10',
    'TAREA_ENTREGADA',
    'TAREA_REENTREGADA'
  ) NOT NULL,
  minutos_antes INT DEFAULT NULL,
  mensaje VARCHAR(255) NOT NULL,
  fecha_programada DATETIME NOT NULL,
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado ENUM('Programada', 'Leida', 'Cancelada') NOT NULL DEFAULT 'Programada',
  leida TINYINT(1) NOT NULL DEFAULT 0,
  fecha_lectura DATETIME DEFAULT NULL,
  evento_origen ENUM('Vencimiento', 'Entrega', 'Reentrega') NOT NULL,
  version_vencimiento INT UNSIGNED DEFAULT NULL,
  id_entrega INT DEFAULT NULL,
  clave_idempotencia VARCHAR(160) NOT NULL,
  PRIMARY KEY (id_notificacion),
  UNIQUE KEY uk_notificacion_idempotencia (clave_idempotencia),
  KEY idx_notificaciones_destinatario (destinatario_id, estado, fecha_programada),
  KEY idx_notificaciones_tarea (id_tarea, tipo, version_vencimiento),
  KEY idx_notificaciones_entrega (id_entrega),
  CONSTRAINT fk_notificaciones_tarea
    FOREIGN KEY (id_tarea) REFERENCES checklist_tareas (id_tarea),
  CONSTRAINT fk_notificaciones_destinatario
    FOREIGN KEY (destinatario_id) REFERENCES usuarios (id_usuario),
  CONSTRAINT fk_notificaciones_entrega
    FOREIGN KEY (id_entrega) REFERENCES checklist_entregas (id_entrega) ON DELETE SET NULL,
  CONSTRAINT chk_notificaciones_minutos CHECK (
    (tipo IN ('VENCIMIENTO_30','VENCIMIENTO_20','VENCIMIENTO_10') AND minutos_antes IN (10,20,30))
    OR
    (tipo IN ('TAREA_ENTREGADA','TAREA_REENTREGADA') AND minutos_antes IS NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
