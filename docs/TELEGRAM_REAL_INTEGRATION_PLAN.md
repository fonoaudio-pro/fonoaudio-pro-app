# Plan de Integración Real — Telegram

**Fecha**: 2026-06-30
**Estado**: Preparado para activación
**Depende de**: Bot token de Telegram + Supabase Edge Function

---

## 1. Credenciales necesarias

| Credencial | Dónde se usa | Cómo se obtiene |
|-----------|-------------|-----------------|
| `TELEGRAM_BOT_TOKEN` | Edge Function (server-side, nunca en frontend) | @BotFather → `/newbot` → copiar token |
| `SUPABASE_URL` | Edge Function | Ya existe en `.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Function | Ya existe en `.env` (nunca en frontend) |

**No se necesita**: `VITE_TELEGRAM_BOT_TOKEN` — el token NUNCA va al frontend.

---

## 2. Arquitectura de la integración

```
Frontend (Browser)                    Edge Function (Supabase)              Telegram API
┌─────────────────────┐               ┌──────────────────────┐               ┌─────────────┐
│ TelegramService.ts  │──── POST ────▶│ /send-telegram       │──── POST ────▶│ Bot API     │
│ - sendMessage()     │               │ - Valida params      │               │ sendMessage │
│ - sendAlert()       │               │ - Llama a Bot API    │               │             │
│ - sendDocument()    │               │ - Registra en DB     │               │             │
└─────────────────────┘               └──────────────────────┘               └─────────────┘
        │                                       │
        │ localStorage (logs)                   │ Supabase DB (telegram_messages)
        ▼                                       ▼
   Logs en browser                        Trazabilidad server-side
```

### Por qué Edge Function
- El token de Telegram NUNCA expone al frontend
- La Edge Function tiene acceso a `SUPABASE_SERVICE_ROLE_KEY`
- Permite RLS y auditoría server-side
- Las Edge Functions de Supabase ya están configuradas en el proyecto

---

## 3. Mensajes permitidos

| Tipo | Template | Ejemplo |
|------|----------|---------|
| Recomendación clínica | `📋 Recomendación clínica para {patientName}: {content}` | "Se ha actualizado la historia clínica..." |
| Alerta de seguimiento | `⚠️ {alertTitle}\n\n{alertMessage}` | "El paciente tiene seguimiento pendiente..." |
| Documento | `📄 {documentName}\n{caption}` | "📄 audiometría_results.pdf" |
| Recordatorio de cita | `📅 Recordatorio: Tu cita es el {date} a las {time}` | Automático 24h antes |

---

## 4. Mensajes prohibidos

| Tipo | Razón |
|------|-------|
| Diagnóstico | Solo profesional diagnostica |
| Prescripción | Acción exclusiva del profesional |
| Datos clínicos sensibles | No se envían por Telegram |
| Respuesta automática a consultas | Sin agente autónomo |
| Historial completo | Violación de privacidad |

---

## 5. Trazabilidad

### Cada mensaje registrado con:
```typescript
{
  id: UUID,
  patient_id: UUID,        // Paciente afectado
  contact_id: UUID,        // Contacto de Telegram
  direction: 'outbound',   // Siempre saliente desde la app
  message_type: 'text' | 'document' | 'alert',
  content: string,         // Contenido del mensaje
  sent_by: UUID,           // Profesional que envió
  sent_by_name: string,    // Nombre del profesional
  telegram_message_id: number,  // ID real de Telegram
  status: 'sent' | 'failed',
  created_at: TIMESTAMPTZ
}
```

### Dónde se registra:
- **Frontend**: `localStorage` (logs de UI, `fonoaudio_telegram_log`)
- **Server-side**: Supabase table `telegram_messages` (trazabilidad real)

---

## 6. Fallback si Telegram falla

```
Envío falla → TelegramService.catch()
  → Log en localStorage con status: 'failed'
  → Toast de error al usuario: "Error al enviar por Telegram. Intentá de nuevo."
  → Mensaje NO se pierde: queda guardado en localStorage
  → Reintentar manualmente desde la UI
```

### Estados posibles del botón:
| Estado | Badge | Significado |
|--------|-------|-------------|
| `idle` | — | Listo para enviar |
| `sending` | Spinner | En progreso |
| `sent` | ✅ verde | Enviado exitosamente |
| `failed` | ❌ rojo | Error — reintentar |

---

## 7. Pasos de implementación (orden exacto)

### Paso 1: Crear bot de Telegram
1. Abrir @BotFather en Telegram
2. `/newbot` → nombre: `FonoAudioPro Bot`
3. Copiar el token → guardar como `TELEGRAM_BOT_TOKEN`
4. Configurar comando `/start` con mensaje de bienvenida

### Paso 2: Crear Edge Function
```
supabase/functions/send-telegram/index.ts
```
- Recibe: `{ patientId, chatId, content, messageType }`
- Usa `TELEGRAM_BOT_TOKEN` (variable de entorno de Supabase)
- Llama a `https://api.telegram.org/bot{token}/sendMessage`
- Registra en `telegram_messages`
- Retorna: `{ success, telegramMessageId }`

### Paso 3: Configurar variables de entorno
En Supabase Dashboard → Edge Functions → Secrets:
- `TELEGRAM_BOT_TOKEN`: `123456:ABC-DEF...`

### Paso 4: Actualizar TelegramService.ts
Reemplazar `localStorage` por llamada a Edge Function:
```typescript
static async sendMessage(params) {
  const { data, error } = await supabase.functions.invoke('send-telegram', {
    body: { patientId, chatId, content, messageType }
  });
  if (error) throw error;
  return data;
}
```

### Paso 5: Crear tabla `telegram_contacts`
Migración Supabase:
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

### Paso 6: Vincular paciente a contacto de Telegram
Desde la UI del paciente → botón "Vincular contacto de Telegram" → ingresar chat_id o username.

### Paso 7: Prueba real
1. Enviar mensaje de prueba a un chat_id conocido
2. Verificar que llega en Telegram
3. Verificar registro en `telegram_messages`
4. Verificar badge `✅` en la UI
5. Verificar log en `fonoaudio_telegram_log`

---

## 8. Qué se mantiene del stub

| Concepto | Se mantiene | Cambio |
|----------|------------|--------|
| UI (botones, menú) | ✅ | Sin cambios |
| Labels `STUB` | Se reemplazan por `✅` | Solo después de prueba exitosa |
| localStorage logs | ✅ | Se mantiene como cache local |
| Toast messages | ✅ | Se mantiene feedback al usuario |
| Types/interfaces | ✅ | Sin cambios |

---

## 9. Criterio de éxito

- [ ] Bot de Telegram creado y activo
- [ ] Edge Function desplegada y funcionando
- [ ] Envío manual de mensaje exitoso
- [ ] Mensaje recibido en Telegram real
- [ ] Registro en `telegram_messages` visible
- [ ] Badge `STUB` reemplazado por indicador de estado real
- [ ] Build verde + sin errores en consola

---

## 10. Riesgos conocidos

| Riesgo | Mitigación |
|--------|-----------|
| Bot token expuesto en frontend | NUNCA — Edge Function server-side |
| Rate limiting de Telegram | Máx 3 msgs/paciente/día, horario 8:00-20:00 |
| Chat_id inválido | Validar antes de enviar, mostrar error claro |
| Edge Function caída | Fallback a localStorage, reintento manual |
| Paciente sin contacto de Telegram | UI muestra "Vincular contacto" antes de enviar |

---

## Última Actualización
2026-06-30 — Plan concreto de integración real de Telegram preparado.
