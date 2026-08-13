# Reactivación: Telegram como Canal Trazable

**Fecha**: 2026-06-28
**Estado**: Diseño de arquitectura
**Regla**: Telegram es un canal de comunicación, no un agente autónomo

---

## 1. Definición del canal

### 1.1 Qué es Telegram para FonoAudio-Pro
- **Canal de comunicación bidireccional** entre profesional y paciente/familia
- **Canal de notificaciones** para recordatorios y alertas
- **NO es un asistente**: no diagnostica, no modifica datos, no ejecuta acciones
- **Trazable**: cada mensaje queda registrado con origen y destino

### 1.2 Casos de uso permitidos
| Caso | Descripción | Quién inicia |
|------|-------------|--------------|
| Recordatorio de cita | Envío automático 24h antes | Sistema |
| Resultado de evaluación | Resumen formateado para familia | Profesional |
| Guía de hogar | Material de estimulación para casa | Profesional |
| Alerta de seguimiento | Notificación de seguimiento pendiente | Sistema |
| Confirmación de cita | Paciente confirma asistencia | Paciente |

### 1.3 Casos de uso PROHIBIDOS
| Caso | Razón |
|------|-------|
| Diagnóstico por chat | Solo profesional diagnostica |
| Modificación de datos | Solo la app modifica datos clínicos |
| Prescripción de tratamiento | Acción exclusiva del profesional |
| Evaluación clínica por mensaje | Requiere presencia profesional |
| Acceso a historial completo | Violación de privacidad |

---

## 2. Arquitectura técnica

### 2.1 Componentes
```
┌─────────────────────────────────────────────────┐
│                  FonoAudio-Pro                   │
│                                                  │
│  ┌──────────────┐    ┌──────────────────────┐   │
│  │   Profesional │    │   Paciente/Familia   │   │
│  │   (Web App)   │    │   (Telegram)         │   │
│  └──────┬───────┘    └──────────┬───────────┘   │
│         │                       │                │
│         ▼                       ▼                │
│  ┌──────────────────────────────────────────┐   │
│  │           TelegramService                 │   │
│  │  - sendMessage()                          │   │
│  │  - receiveMessage()                       │   │
│  │  - logMessage()                           │   │
│  └──────────────────┬───────────────────────┘   │
│                     │                            │
│                     ▼                            │
│  ┌──────────────────────────────────────────┐   │
│  │           Supabase                        │   │
│  │  - telegram_messages                      │   │
│  │  - telegram_configs                       │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### 2.2 Flujo de mensaje saliente (profesional → paciente)
```
1. Profesional selecciona paciente
2. Profesional hace clic en "Enviar por Telegram"
3. Sistema muestra preview del mensaje
4. Profesional confirma envío
5. TelegramService.sendMessage() envía a través de Bot API
6. Sistema registra en telegram_messages
7. Badge [Telegram] aparece en historial del paciente
```

### 2.3 Flujo de mensaje entrante (paciente → sistema)
```
1. Paciente envía mensaje por Telegram
2. Webhook recibe en TelegramService
3. Sistema identifica paciente por chat_id
4. Sistema registra en telegram_messages
5. Si es confirmación de cita → actualiza estado
6. Si es consulta → notifica al profesional
7. NO responde automáticamente (sin agente)
```

---

## 3. Modelo de datos

### 3.1 Tabla: telegram_configs
```sql
CREATE TABLE telegram_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  bot_token TEXT NOT NULL,
  bot_username TEXT NOT NULL,
  webhook_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.2 Tabla: telegram_contacts
```sql
CREATE TABLE telegram_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  chat_id BIGINT NOT NULL,
  username TEXT,
  full_name TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(patient_id, chat_id)
);
```

### 3.3 Tabla: telegram_messages
```sql
CREATE TABLE telegram_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id),
  contact_id UUID REFERENCES telegram_contacts(id),
  direction TEXT CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT CHECK (message_type IN ('text', 'document', 'image', 'location')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  sent_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 4. Permisos y control

### 4.1 Quién puede enviar
| Rol | Puede enviar | Puede recibir | Puede ver historial |
|-----|-------------|---------------|---------------------|
| Profesional | ✅ (manual) | ✅ (notificaciones) | ✅ (solo propios) |
| Admin | ✅ (manual) | ✅ | ✅ (todos) |
| Sistema | ✅ (automático) | ✅ | ❌ |

### 4.2 Control de envío
- Cada envío requiere confirmación explícita del profesional
- Mensajes automáticos (recordatorios) tienen límite de frecuencia
- No se envían mensajes fuera del horario laboral (8:00-20:00)
- Cada mensaje queda registrado con `sent_by` y `created_at`

### 4.3 Límites
- Máximo 3 mensajes automáticos por paciente por día
- Máximo 1 mensaje manual por paciente por sesión
- No se envían documentos clínicos sensibles por Telegram
- Los mensajes se eliminan después de 30 días (retención)

---

## 5. Puntos de extensión

### 5.1 Fase 1: Stub preparado
- `services/TelegramService.ts` con interfaz definida
- Tablas en Supabase (migración)
- Punto de conexión en UI

### 5.2 Fase 2: Envío manual
- Botón "Enviar por Telegram" en vista de paciente
- Preview antes de enviar
- Registro de mensajes enviados

### 5.3 Fase 3: Notificaciones automáticas
- Recordatorios de citas (24h antes)
- Alertas de seguimiento pendiente
- Confirmaciones de cita

### 5.4 Fase 4: Recepción
- Webhook para recibir mensajes
- Confirmaciones automáticas de cita
- Notificaciones al profesional

---

## 6. Validación requerida

### 6.1 Antes de activar
- [ ] Bot de Telegram creado y configurado
- [ ] Tablas en Supabase creadas
- [ ] TelegramService implementado
- [ ] UI con botón de envío
- [ ] Sistema de logging funcionando
- [ ] Prueba de envío manual exitosa
- [ ] Prueba de recepción exitosa

### 6.2 Evidencia requerida
- Screenshot de envío de mensaje por Telegram
- Screenshot de mensaje recibido en Telegram
- Log de mensajes en Supabase
- Build verde + tests pasando

---

## Última Actualización
2026-06-28 — Diseño de arquitectura para Telegram como canal trazable.
