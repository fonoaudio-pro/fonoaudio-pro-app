# Reactivación: Celular/Scanner como Herramienta Clínica

**Fecha**: 2026-06-28
**Estado**: Diseño de arquitectura
**Regla**: Scanner es herramienta de captura, no de diagnóstico

---

## 1. Definición del dispositivo

### 1.1 Qué es Celular/Scanner para FonoAudio-Pro
- **Herramienta de captura** de documentos y datos
- **Canal de comunicación** con pacientes (vía Telegram)
- **NO es dispositivo médico**: no diagnostica, no mide, no trata
- **Complemento** al workflow clínico, no reemplazo

### 1.2 Casos de uso permitidos
| Caso | Descripción | Quién usa |
|------|-------------|-----------|
| Captura de documentos | Cédula, consentimientos, informes | Profesional |
| Escaneo de resultados | Audiometría, evaluaciones externas | Profesional |
| Foto de material | Material de trabajo, avances | Profesional |
| Firma digital | Consentimientos informados | Paciente/Profesional |
| Código QR | Acceso rápido a paciente | Profesional |

### 1.3 Casos de uso PROHIBIDOS
| Caso | Razón |
|------|-------|
| Diagnóstico por imagen | Requiere análisis profesional |
| Medición clínica por cámara | No es instrumento médico |
| Evaluación remota | Requiere presencia profesional |
| Tratamiento autónomo | Acción exclusiva del profesional |

---

## 2. Arquitectura técnica

### 2.1 Componentes
```
┌─────────────────────────────────────────────────┐
│                  Celular del Profesional         │
│                                                  │
│  ┌──────────────┐    ┌──────────────────────┐   │
│  │   Cámara      │    │   Scanner API        │   │
│  │   (captura)   │    │   (procesamiento)    │   │
│  └──────┬───────┘    └──────────┬───────────┘   │
│         │                       │                │
│         ▼                       ▼                │
│  ┌──────────────────────────────────────────┐   │
│  │           DocumentService                 │   │
│  │  - captureDocument()                      │   │
│  │  - processOCR()                           │   │
│  │  - uploadToStorage()                      │   │
│  └──────────────────┬───────────────────────┘   │
│                     │                            │
│                     ▼                            │
│  ┌──────────────────────────────────────────┐   │
│  │           Supabase Storage                │   │
│  │  - patient-documents bucket               │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### 2.2 Flujo de captura
```
1. Profesional abre vista de paciente
2. Profesional selecciona "Capturar documento"
3. Sistema abre cámara del celular
4. Profesional toma foto del documento
5. DocumentService processOCR() extrae texto
6. DocumentService uploadToStorage() guarda en Supabase
7. Sistema vincula documento al paciente
8. Badge [Documento] aparece en historial
```

### 2.3 Flujo de escaneo
```
1. Profesional selecciona "Escanear resultado"
2. Sistema abre cámara con modo documento
3. Profesional escanea el resultado
4. DocumentService procesa imagen
5. Sistema guarda en patient-documents
6. Profesional revisa y confirma
7. Documento vinculado al paciente
```

---

## 3. Modelo de datos

### 3.1 Tabla: patient_documents
```sql
CREATE TABLE patient_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  document_type TEXT CHECK (document_type IN (
    'identity', 'consent', 'evaluation', 'result', 
    'report', 'image', 'other'
  )),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  ocr_text TEXT,
  metadata JSONB DEFAULT '{}',
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.2 Storage bucket: patient-documents
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-documents', 'patient-documents', false);

-- Policy: solo el profesional dueño puede ver
CREATE POLICY "Professionals can view own patient documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'patient-documents');

-- Policy: solo el profesional dueño puede subir
CREATE POLICY "Professionals can upload to own patient documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'patient-documents');
```

---

## 4. Permisos y control

### 4.1 Quién puede usar
| Rol | Puede capturar | Puede escanear | Puede ver documentos |
|-----|---------------|----------------|---------------------|
| Profesional | ✅ (propios pacientes) | ✅ | ✅ (suyos) |
| Admin | ✅ | ✅ | ✅ (todos) |
| Paciente | ❌ | ❌ | ❌ |

### 4.2 Control de acceso
- Cada documento está vinculado a un paciente específico
- Solo el profesional que subió el documento puede verlo
- Los documentos se almacenan en bucket privado
- No se comparten externamente sin consentimiento

### 4.3 Límites
- Tamaño máximo: 10 MB por documento
- Formatos aceptados: JPG, PNG, PDF
- Máximo 50 documentos por paciente
- Los documentos se conservan según normativa local

---

## 5. Puntos de extensión

### 5.1 Fase 1: Stub preparado
- `services/DocumentService.ts` con interfaz definida
- Tabla `patient_documents` en Supabase
- Storage bucket configurado
- Punto de conexión en UI

### 5.2 Fase 2: Captura básica
- Botón "Capturar documento" en vista de paciente
- Cámara del navegador (sin OCR)
- Subida a Supabase Storage
- Lista de documentos del paciente

### 5.3 Fase 3: OCR básico
- Integración con API de OCR (gratuita)
- Extracción de texto de documentos
- Búsqueda de texto en documentos
- Indexación para búsqueda

### 5.4 Fase 4: Escaneo avanzado
- Modo documento (detección de bordes)
- Corrección de perspectiva
- Mejora de contraste
- Exportación a PDF

---

## 6. Validación requerida

### 6.1 Antes de activar
- [ ] Tabla `patient_documents` creada en Supabase
- [ ] Storage bucket `patient-documents` configurado
- [ ] DocumentService implementado
- [ ] UI con botón de captura
- [ ] Sistema de logging funcionando
- [ ] Prueba de captura exitosa
- [ ] Prueba de subida a Storage exitosa

### 6.2 Evidencia requerida
- Screenshot de captura de documento
- Screenshot de documento en Storage
- Log de documentos en Supabase
- Build verde + tests pasando

---

## 7. Integración con pipeline clínico

### 7.1 Documentos vinculados a pacientes
```
Captura → Storage → Vínculo con paciente → Historial clínico
```

### 7.2 Uso en generación de materiales
```
Documento capturado → OCR → Extracción de datos → Generación de material
```

### 7.3 Trazabilidad
```
Cada documento tiene: who (profesional), when (timestamp), what (tipo), where (paciente)
```

---

## Última Actualización
2026-06-28 — Diseño de arquitectura para Celular/Scanner como herramienta clínica.
