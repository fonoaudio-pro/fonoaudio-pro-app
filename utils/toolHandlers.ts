// Comprehensive tool handler implementation for voice assistant
// This file contains all the logic for handling voice assistant tool calls

import { REPORT_GUIDES } from './reportTemplates';

export async function handleToolCall(
    fc: any,
    stateRefs: any,
    actions: any,
    supabase: any,
    TREATMENT_PLAN_TEMPLATE: string,
    setAssistantFeedback: (msg: string) => void
): Promise<any> {
    console.log(`[ToolHandler] Handling: ${fc.name}`, fc.args);
    let result: any = { status: "ok" };

    // Timeout-aware fetch helper — prevents hanging requests
    const fetchWithTimeout = async (url: string, opts: any = {}, timeoutMs = 15000) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, { ...opts, signal: controller.signal });
            return res;
        } catch (e: any) {
            if (e.name === 'AbortError') {
                throw new Error(`Timeout: la operación tardó más de ${timeoutMs / 1000}s y fue cancelada.`);
            }
            throw e;
        } finally {
            clearTimeout(timer);
        }
    };

    try {
        // Helper functions
        const findPatient = (name: string) => {
            if (!name) return stateRefs.selectedPatient.current;
            const query = name.toLowerCase().trim();
            // 1. Intento por selección actual
            if (stateRefs.selectedPatient.current && stateRefs.selectedPatient.current.name.toLowerCase().includes(query)) {
                return stateRefs.selectedPatient.current;
            }
            // 2. Búsqueda por inclusión (más permisiva)
            return stateRefs.patients.current.find((p: any) =>
                p.name.toLowerCase().includes(query) || query.includes(p.name.toLowerCase())
            );
        };

        const syncAlertsForConsent = (patient: any): string[] => {
            const alerts = [...(patient.alerts || [])];
            if (patient.consentSigned) {
                return alerts.filter(a => !a.toLowerCase().includes('consentimiento'));
            } else {
                if (!alerts.some(a => a.toLowerCase().includes('consentimiento'))) {
                    alerts.push('Falta Firmar Consentimiento Informado');
                }
                return alerts;
            }
        };

        const getMissingFieldsFor = (p: any): string[] => {
            return [
                !p.document && "documento",
                !p.email && "email",
                !p.phone && "teléfono",
                !p.consentSigned && "consentimiento informado",
                !p.responsable && "responsable/tutor",
                !p.obra_social && "obra social",
            ].filter(Boolean) as string[];
        };

        switch (fc.name) {
            // ===== SPANISH ALIASES → English actions =====
            case "mostrar_pacientes":
            case "abrir_pacientes":
            case "ir_a_pacientes":
                fc.name = "navigate";
                fc.args = fc.args || {};
                fc.args.view = "patients";
                break;

            case "abrir_consultorios":
            case "ir_a_consultorios":
            case "ver_consultorios":
            case "seleccionar_consultorio":
                fc.name = "navigate";
                fc.args = fc.args || {};
                fc.args.view = "consultorios";
                break;

            case "abrir_canal_clinico":
            case "ir_a_telegram":
            case "ver_mensajes":
                fc.name = "navigate";
                fc.args = fc.args || {};
                fc.args.view = "telegram";
                break;

            case "abrir_fuentes_clinicas":
            case "ir_a_fuentes":
            case "ver_fuentes":
            case "abrir_fuentes_clínicas":
                fc.name = "navigate";
                fc.args = fc.args || {};
                fc.args.view = "sources";
                break;

            case "abrir_notebooklm":
            case "ir_a_notebooklm":
            case "ver_notebooklm":
            case "abrir_notebook_lm":
                fc.name = "navigate";
                fc.args = fc.args || {};
                fc.args.view = "notebooklm";
                break;

            case "abrir_agenda":
            case "ir_a_agenda":
            case "ver_agenda":
                fc.name = "navigate";
                fc.args = fc.args || {};
                fc.args.view = "agenda";
                break;

            case "abrir_informes_inteligentes":
            case "abrir_informes":
            case "ir_a_informes":
            case "ver_informes":
                fc.name = "navigate";
                fc.args = fc.args || {};
                fc.args.view = "reports";
                break;

            case "abrir_biblioteca":
            case "abrir_materiales":
            case "ir_a_materiales":
                fc.name = "navigate";
                fc.args = fc.args || {};
                fc.args.view = "materials";
                break;

            case "abrir_buscador":
            case "abrir_notebooklm":
            case "ir_a_academico":
                fc.name = "navigate";
                fc.args = fc.args || {};
                fc.args.view = "academic";
                break;

            case "abrir_panel_automatizaciones":
            case "abrir_automatizaciones":
            case "ir_a_automatizaciones":
                fc.name = "navigate";
                fc.args = fc.args || {};
                fc.args.view = "automations";
                break;

            case "abrir_consola_base_de_datos":
            case "abrir_db":
            case "ir_a_db":
                fc.name = "navigate";
                fc.args = fc.args || {};
                fc.args.view = "dbManager";
                break;

            case "modo_noche":
            case "modo_oscuro":
                fc.name = "toggle_dark_mode";
                fc.args = fc.args || {};
                break;

            // ===== GREETINGS =====
            case "Saludo":
                setAssistantFeedback(`Hola! Soy tu asistente clínico.`);
                result = { success: true };
                break;
                
            // ===== NAVIGATION & UI =====
            case "navigate":
                // Soporta: {view: "patients", patientName: "...", tab: "..."}
                if (fc.args.view === 'consultorios') {
                    actions.setSelectedPatientId(null);
                    actions.setSelectedConsultorio(null);
                    actions.setCurrentView('consultorios');
                    setAssistantFeedback('Mostrando Consultorios');
                    result = { success: true, navigatedTo: 'consultorios', message: 'Te llevó a Consultorios. Ahí podés seleccionar un consultorio para ver sus pacientes.' };
                } else if (fc.args.patientName) {
                    const p = findPatient(fc.args.patientName);
                    if (p) {
                        actions.setCurrentView('patients');
                        actions.setSelectedPatient(p);
                        if (fc.args.tab) actions.setActivePatientTab(fc.args.tab);
                        setAssistantFeedback(`Mostrando ${p.name}`);
                        
                        const missing = getMissingFieldsFor(p);
                        result = { 
                            success: true, 
                            patient: { name: p.name },
                            warnings: missing.length > 0 ? missing : null,
                            message: `Navegando a la ficha de ${p.name}.`
                        };
                    } else result = { error: "Paciente no encontrado", message: `No encontré un paciente con el nombre "${fc.args.patientName}".` };
                } else {
                    actions.setCurrentView(fc.args.view);
                    setAssistantFeedback(`Navegando a ${fc.args.view}`);
                    result = { success: true, navigatedTo: fc.args.view, message: `Navegando a ${fc.args.view}.` };
                }
                break;

            case "n8n_execute":
                setAssistantFeedback(`Ejecutando: ${fc.args.workflow}...`);
                try {
                    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
                    await fetchWithTimeout(`${backendUrl}/api/event`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ event: `workflow_${fc.args.workflow}`, data: fc.args.data || { patient: stateRefs.selectedPatient.current } }),
                    });
                    setAssistantFeedback(`✓ ${fc.args.workflow} ejecutado`);
                    result = { success: true };
                } catch(e: any) { 
                    console.error("Error backend:", e);
                    result = { error: `Fallo en backend: ${e.message}` }; 
                }
                break;

            case "show_visual_feedback":
                setAssistantFeedback(fc.args.message);
                result = { success: true };
                break;

            case "toggle_dark_mode":
                if (actions.toggleDarkMode) {
                    actions.toggleDarkMode();
                    setAssistantFeedback('Modo oscuro cambiado');
                } else {
                    setAssistantFeedback('Cambiando modo visual...');
                }
                result = { success: true };
                break;

            // ===== PATIENT MANAGEMENT =====
            case "create_patient":
                setAssistantFeedback(`Creando paciente ${fc.args.name}...`);
                const newPatient = {
                    id: crypto.randomUUID(),
                    name: fc.args.name,
                    age: Number(fc.args.age),
                    diagnosis: fc.args.diagnosis,
                    phone: fc.args.phone || "",
                    email: fc.args.email || "",
                    document: fc.args.document || "",
                    notes: fc.args.notes || "",
                    responsable: fc.args.responsable || "",
                    derivante: fc.args.derivante || "",
                    obra_social: fc.args.obra_social || fc.args.obraSocial || "",
                    location: fc.args.location || "",
                    alerts: [],
                    consentSigned: false,
                    treatmentPlan: { general: "", specific: [], strategies: TREATMENT_PLAN_TEMPLATE },
                    history: [],
                    evaluations: [],
                    documents: [],
                    reports: [],
                };
                await actions.handleCreatePatient(newPatient);
                setAssistantFeedback(`✓ Paciente ${fc.args.name} creado`);
                result = { success: true, patientId: newPatient.id, message: `Paciente "${fc.args.name}" creado exitosamente.` };
                break;

            case "update_patient":
                setAssistantFeedback(`Actualizando paciente ${fc.args.patientName}...`);
                let patientToUpdate = findPatient(fc.args.patientName);
                if (patientToUpdate) {
                    const updates: any = {};
                    if (fc.args.name) updates.name = fc.args.name;
                    if (fc.args.age) updates.age = Number(fc.args.age);
                    if (fc.args.diagnosis) updates.diagnosis = fc.args.diagnosis;
                    if (fc.args.phone) updates.phone = fc.args.phone;
                    if (fc.args.email) updates.email = fc.args.email;
                    if (fc.args.document) updates.document = fc.args.document;
                    if (fc.args.notes) updates.notes = fc.args.notes;
                    if (fc.args.responsable !== undefined) updates.responsable = fc.args.responsable;
                    if (fc.args.derivante !== undefined) updates.derivante = fc.args.derivante;
                    if (fc.args.obra_social !== undefined || fc.args.obraSocial !== undefined) updates.obra_social = fc.args.obra_social || fc.args.obraSocial;
                    if (fc.args.location !== undefined) updates.location = fc.args.location;
                    if (fc.args.consentSigned !== undefined) updates.consentSigned = fc.args.consentSigned === 'true';
                    if (fc.args.alerts !== undefined) updates.alerts = typeof fc.args.alerts === 'string' ? JSON.parse(fc.args.alerts) : fc.args.alerts;

                    let updatedPatient = { ...patientToUpdate, ...updates };

                    // Auto-sync alerts with consentSigned
                    if (fc.args.consentSigned !== undefined) {
                        updatedPatient.alerts = syncAlertsForConsent(updatedPatient);
                        updates.alerts = updatedPatient.alerts;
                    }

                    actions.setPatients((prev: any[]) =>
                        prev.map((p) => (p.id === patientToUpdate.id ? updatedPatient : p))
                    );
                    if (stateRefs.selectedPatient.current?.id === patientToUpdate.id) {
                        actions.setSelectedPatient(updatedPatient);
                    }
                    await supabase.from("patients").update(updates).eq("id", patientToUpdate.id);
                    setAssistantFeedback(`✓ Paciente actualizado`);
                    result = { success: true, updated: Object.keys(updates), message: `Paciente "${patientToUpdate.name}" actualizado: ${Object.keys(updates).join(', ')}.` };
                } else {
                    result = { error: "Paciente no encontrado" };
                }
                break;

            case "delete_patient":
                setAssistantFeedback(`Eliminando paciente ${fc.args.patientName}...`);
                const patientToDelete = findPatient(fc.args.patientName);
                if (patientToDelete) {
                    actions.setPatients((prev: any[]) => prev.filter((p) => p.id !== patientToDelete.id));
                    if (stateRefs.selectedPatient.current?.id === patientToDelete.id) {
                        actions.setSelectedPatient(null);
                    }
                    await supabase.from("patients").delete().eq("id", patientToDelete.id);
                    setAssistantFeedback(`✓ Paciente eliminado`);
                    result = { success: true, message: `Paciente "${patientToDelete.name}" eliminado del sistema.` };
                } else {
                    result = { error: "Paciente no encontrado" };
                }
                break;

            case "get_patient_info":
                const patientInfo = findPatient(fc.args.patientName);
                if (patientInfo) {
                    // Navigate to patient profile automatically
                    actions.setCurrentView('patients');
                    actions.setSelectedPatient(patientInfo);
                    setAssistantFeedback(`Mostrando perfil de ${patientInfo.name}`);

                    // Check for missing data
                    const warnings = [];
                    if (!patientInfo.document) warnings.push("Falta DNI/Documento");
                    if (!patientInfo.email) warnings.push("Falta Email");
                    if (!patientInfo.phone) warnings.push("Falta Teléfono");
                    if (!patientInfo.diagnosis) warnings.push("Falta Diagnóstico");

                    result = {
                        success: true,
                        patient: {
                            name: patientInfo.name,
                            age: patientInfo.age,
                            diagnosis: patientInfo.diagnosis,
                            phone: patientInfo.phone,
                            email: patientInfo.email,
                            document: patientInfo.document,
                            notes: patientInfo.notes,
                            history: patientInfo.history?.slice(-5) || [],
                            evaluations: patientInfo.evaluations || [],
                            reports: patientInfo.reports?.map((r: any) => ({ id: r.id, title: r.title, date: r.date, type: r.type })) || [],
                            documents: patientInfo.documents?.map((d: any) => ({ id: d.id, name: d.name, date: d.date, summary: d.aiSummary })) || [],
                            warnings: warnings.length > 0 ? warnings : null
                        },
                        message: `Ficha de ${patientInfo.name}: ${patientInfo.age || '?'} años, diagnóstico: ${patientInfo.diagnosis || 'no especificado'}.`,
                    };
                } else {
                    result = { error: "Paciente no encontrado" };
                }
                break;

            case "add_patient_general_note":
                setAssistantFeedback(`Agregando nota a ${fc.args.patientName}...`);
                const patientForNote = findPatient(fc.args.patientName);
                if (patientForNote) {
                    const newNote = fc.args.note;
                    const timestamp = new Date().toLocaleString();
                    const updatedNotes = patientForNote.notes
                        ? `${patientForNote.notes}\n\n[${timestamp}] ${newNote}`
                        : `[${timestamp}] ${newNote}`;

                    const updatedPatient = { ...patientForNote, notes: updatedNotes };

                    actions.setPatients((prev: any[]) =>
                        prev.map((p) => (p.id === patientForNote.id ? updatedPatient : p))
                    );

                    if (stateRefs.selectedPatient.current?.id === patientForNote.id) {
                        actions.setSelectedPatient(updatedPatient);
                    }

                    await supabase.from("patients").update({ notes: updatedNotes }).eq("id", patientForNote.id);
                    setAssistantFeedback(`✓ Nota agregada`);
                    result = { success: true, message: `Nota agregada a ${patientForNote.name}: "${fc.args.note.substring(0, 50)}${fc.args.note.length > 50 ? '...' : ''}".` };
                } else {
                    result = { error: "Paciente no encontrado" };
                }
                break;

            case "list_all_patients":
                result = {
                    success: true,
                    patients: stateRefs.patients.current.map((p: any) => ({
                        name: p.name,
                        age: p.age,
                        diagnosis: p.diagnosis,
                    })),
                    total: stateRefs.patients.current.length,
                };
                break;

            // ===== CLINIC HIERARCHY (CENTROS Y CONSULTORIOS) =====
            case "create_center":
                setAssistantFeedback(`Creando consultorio ${fc.args.name}...`);
                const { data: newCenter, error: centerErr } = await supabase
                    .from('consultorios')
                    .insert({ id: `center_${Date.now()}`, name: fc.args.name, is_active: true })
                    .select()
                    .single();
                if (centerErr) { result = { error: `Error creando consultorio: ${centerErr.message}` }; break; }
                result = { success: true, center: newCenter };
                break;

            case "create_room":
                setAssistantFeedback(`Creando consultorio ${fc.args.name}...`);
                const { data: newRoom, error: roomErr } = await supabase
                    .from('consultorios')
                    .insert({ id: `room_${Date.now()}`, name: fc.args.name, is_active: true })
                    .select()
                    .single();
                if (roomErr) { result = { error: `Error creando consultorio: ${roomErr.message}` }; break; }
                result = { success: true, room: newRoom };
                break;

            case "list_centers":
            case "list_rooms":
                setAssistantFeedback(`Obteniendo consultorios...`);
                const { data: consultorios, error: cErr } = await supabase
                    .from('consultorios')
                    .select('*')
                    .eq('is_active', true)
                    .order('name');
                if (cErr) { result = { error: `Error: ${cErr.message}` }; break; }
                result = { success: true, consultorios: (consultorios || []).map((c: any) => ({ id: c.id, name: c.name, color: c.color, icon: c.icon })), total: (consultorios || []).length };
                break;

            case "list_patients_in_room":
                setAssistantFeedback(`Buscando pacientes en ${fc.args.roomName || fc.args.consultorioName}...`);
                const roomQuery = (fc.args.roomName || fc.args.consultorioName || '').toLowerCase();
                const { data: allConsultorios } = await supabase.from('consultorios').select('id, name').eq('is_active', true);
                const matchedRoom = (allConsultorios || []).find((c: any) => c.name.toLowerCase().includes(roomQuery));
                if (!matchedRoom) {
                    result = { error: `No encontré consultorio "${fc.args.roomName || fc.args.consultorioName}". Disponibles: ${(allConsultorios || []).map((c: any) => c.name).join(', ')}` };
                    break;
                }
                const patientsInRoom = stateRefs.patients.current.filter((p: any) => p.consultorio_id === matchedRoom.id || p.consultorio === matchedRoom.name);
                result = { consultorio: matchedRoom.name, patients: patientsInRoom.map((p: any) => ({ name: p.name, age: p.age, diagnosis: p.diagnosis })), total: patientsInRoom.length };
                break;
                const roomPatients = stateRefs.patients.current.filter((p: any) => p.roomId === fc.args.roomId);
                result = { success: true, patients: roomPatients };
                break;

            // ===== APPOINTMENTS =====
            case "create_appointment":
                setAssistantFeedback(`Creando cita para ${fc.args.patientName}...`);
                const patientForAppt = findPatient(fc.args.patientName);
                if (patientForAppt) {
                    const newAppt = {
                        id: Date.now().toString(),
                        patientId: patientForAppt.id,
                        patientName: patientForAppt.name,
                        date: fc.args.date,
                        time: fc.args.time,
                        status: "pending" as const,
                        type: fc.args.type || "Consulta",
                        notes: fc.args.notes || "",
                    };
                    actions.setAppointments((prev: any[]) => [...prev, newAppt]);
                    await supabase.from("appointments").insert([newAppt]);
                    setAssistantFeedback(`✓ Cita creada para ${fc.args.date} a las ${fc.args.time}`);
                    result = { success: true, appointmentId: newAppt.id, message: `Cita creada para ${patientForAppt.name} el ${fc.args.date} a las ${fc.args.time}.` };
                } else {
                    result = { error: "Paciente no encontrado" };
                }
                break;

            case "create_google_meet_link":
                setAssistantFeedback(`Generando enlace de Google Meet...`);
                try {
                    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
                    const res = await fetchWithTimeout(`${backendUrl}/api/google/meet`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            patientName: fc.args.patientName,
                            date: fc.args.date,
                            time: fc.args.time,
                            reason: fc.args.reason || "Reunión Clínica"
                        })
                    });
                    const data = await res.json();
                    if (data.status === 'ok') {
                        setAssistantFeedback(`✓ Enlace generado`);
                        result = { success: true, meetLink: data.meetLink, message: `Enlace de Google Meet generado: ${data.meetLink}` };
                    } else {
                        result = { error: data.message, message: `Error: ${data.message}` };
                    }
                } catch (e: any) {
                    result = { error: `Error de conexión: ${e.message}`, message: `Error de conexión: ${e.message}` };
                }
                break;

            case "sync_google_calendar":
                setAssistantFeedback(`Sincronizando con Google Calendar...`);
                try {
                    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
                    const res = await fetchWithTimeout(`${backendUrl}/api/google/calendar/sync`, {
                        method: 'POST'
                    });
                    const data = await res.json();
                    if (data.status === 'ok') {
                        setAssistantFeedback(`✓ Agenda sincronizada`);
                        result = { success: true, appointments: data.appointments, message: `Calendario sincronizado. ${data.appointments?.length || 0} eventos actualizados.` };
                    } else {
                        result = { error: data.message, message: `Error: ${data.message}` };
                    }
                } catch (e: any) {
                    result = { error: `Error de conexión: ${e.message}` };
                }
                break;

            case "update_appointment":

                setAssistantFeedback(`Actualizando cita...`);
                const patientForUpdate = findPatient(fc.args.patientName);
                if (patientForUpdate) {
                    const apptToUpdate = stateRefs.appointments.current.find(
                        (a: any) => a.patientId === patientForUpdate.id && a.status === "pending"
                    );
                    if (apptToUpdate) {
                        const updates: any = {};
                        if (fc.args.date) updates.date = fc.args.date;
                        if (fc.args.time) updates.time = fc.args.time;
                        if (fc.args.status) updates.status = fc.args.status;
                        if (fc.args.type) updates.type = fc.args.type;
                        if (fc.args.notes) updates.notes = fc.args.notes;

                        const updatedAppt = { ...apptToUpdate, ...updates };
                        actions.setAppointments((prev: any[]) =>
                            prev.map((a) => (a.id === apptToUpdate.id ? updatedAppt : a))
                        );
                        await supabase.from("appointments").update(updates).eq("id", apptToUpdate.id);
                        setAssistantFeedback(`✓ Cita actualizada`);
                        result = { success: true, message: `Cita de ${patientForUpdate.name} actualizada: ${Object.keys(updates).join(', ')}.` };
                    } else {
                        result = { error: "No se encontró cita pendiente" };
                    }
                } else {
                    result = { error: "Paciente no encontrado" };
                }
                break;

            case "delete_appointment":
                setAssistantFeedback(`Eliminando cita...`);
                const patientForDelete = findPatient(fc.args.patientName);
                if (patientForDelete) {
                    const apptToDelete = stateRefs.appointments.current.find(
                        (a: any) => a.patientId === patientForDelete.id && a.date === fc.args.date
                    );
                    if (apptToDelete) {
                        actions.setAppointments((prev: any[]) => prev.filter((a) => a.id !== apptToDelete.id));
                        await supabase.from("appointments").delete().eq("id", apptToDelete.id);
                        setAssistantFeedback(`✓ Cita eliminada`);
                        result = { success: true, message: `Cita de ${patientForDelete.name} el ${fc.args.date} eliminada.` };
                    } else {
                        result = { error: "Cita no encontrada" };
                    }
                } else {
                    result = { error: "Paciente no encontrado" };
                }
                break;

            case "get_agenda":
                const date = fc.args.date;
                const today = new Date().toISOString().split('T')[0];
                const filteredAppts = date
                    ? stateRefs.appointments.current.filter((a: any) => a.date === date)
                    : stateRefs.appointments.current.filter((a: any) => a.date >= today && a.status !== 'cancelled');
                result = {
                    success: true,
                    appointments: filteredAppts.map((a: any) => ({
                        patient: a.patientName,
                        date: a.date,
                        time: a.time,
                        type: a.type,
                        status: a.status,
                    })),
                    total: filteredAppts.length,
                    message: `${filteredAppts.length} cita(s) ${date ? `para el ${date}` : 'desde hoy'}.`,
                };
                break;

            // ===== REPORTS =====
            case "get_patient_reports":
                const patientForReports = findPatient(fc.args.patientName);
                if (patientForReports) {
                    const limit = fc.args.limit || 3;
                    const type = fc.args.reportType;

                    let reports = patientForReports.reports || [];
                    if (type) {
                        reports = reports.filter((r: any) => r.type === type || r.title.toLowerCase().includes(type.toLowerCase()));
                    }

                    // Sort by date desc
                    reports.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

                    const selectedReports = reports.slice(0, limit);

                    result = {
                        success: true,
                        reports: selectedReports,
                        totalFound: reports.length
                    };
                } else {
                    result = { error: "Paciente no encontrado" };
                }
                break;

            case "create_report":
                setAssistantFeedback(`Creando informe para ${fc.args.patientName}...`);
                const patientForReport = findPatient(fc.args.patientName);
                if (patientForReport) {
                    const newReport = {
                        id: Date.now().toString(),
                        date: new Date().toISOString().split("T")[0],
                        title: fc.args.title,
                        content: fc.args.content,
                        type: fc.args.type,
                    };
                    const updatedReports = [...(patientForReport.reports || []), newReport];
                    const updatedPatient = { ...patientForReport, reports: updatedReports };
                    actions.setPatients((prev: any[]) =>
                        prev.map((p) => (p.id === patientForReport.id ? updatedPatient : p))
                    );
                    if (stateRefs.selectedPatient.current?.id === patientForReport.id) {
                        actions.setSelectedPatient(updatedPatient);
                    }
                    await supabase.from("patients").update({ reports: updatedReports }).eq("id", patientForReport.id);
                    setAssistantFeedback(`✓ Informe creado`);
                    result = { success: true, reportId: newReport.id };
                } else {
                    result = { error: "Paciente no encontrado" };
                }
                break;

            case "update_report":
                setAssistantFeedback(`Actualizando informe...`);
                const patientForReportUpdate = findPatient(fc.args.patientName);
                if (patientForReportUpdate) {
                    const reportToUpdate = patientForReportUpdate.reports?.find((r: any) => r.id === fc.args.reportId);
                    if (reportToUpdate) {
                        const updatedReport = {
                            ...reportToUpdate,
                            ...(fc.args.title && { title: fc.args.title }),
                            ...(fc.args.content && { content: fc.args.content }),
                        };
                        const updatedReports = patientForReportUpdate.reports.map((r: any) =>
                            r.id === fc.args.reportId ? updatedReport : r
                        );
                        const updatedPatient = { ...patientForReportUpdate, reports: updatedReports };
                        actions.setPatients((prev: any[]) =>
                            prev.map((p) => (p.id === patientForReportUpdate.id ? updatedPatient : p))
                        );
                        await supabase.from("patients").update({ reports: updatedReports }).eq("id", patientForReportUpdate.id);
                        setAssistantFeedback(`✓ Informe actualizado`);
                        result = { success: true };
                    } else {
                        result = { error: "Informe no encontrado" };
                    }
                } else {
                    result = { error: "Paciente no encontrado" };
                }
                break;

            case "delete_report":
                setAssistantFeedback(`Eliminando informe...`);
                const patientForReportDelete = findPatient(fc.args.patientName);
                if (patientForReportDelete) {
                    const updatedReports = patientForReportDelete.reports?.filter((r: any) => r.id !== fc.args.reportId) || [];
                    const updatedPatient = { ...patientForReportDelete, reports: updatedReports };
                    actions.setPatients((prev: any[]) =>
                        prev.map((p) => (p.id === patientForReportDelete.id ? updatedPatient : p))
                    );
                    await supabase.from("patients").update({ reports: updatedReports }).eq("id", patientForReportDelete.id);
                    setAssistantFeedback(`✓ Informe eliminado`);
                    result = { success: true };
                } else {
                    result = { error: "Paciente no encontrado" };
                }
                break;

            // ===== EVALUATIONS =====
            case "add_evaluation":
                setAssistantFeedback(`Agregando evaluación para ${fc.args.patientName}...`);
                const patientForEval = findPatient(fc.args.patientName);
                if (patientForEval) {
                    const newEval = {
                        id: Date.now().toString(),
                        date: fc.args.date || new Date().toISOString().split("T")[0],
                        testName: fc.args.testName,
                        score: Number(fc.args.score),
                        maxScore: Number(fc.args.maxScore),
                        notes: fc.args.notes || "",
                    };
                    const updatedEvals = [...(patientForEval.evaluations || []), newEval];
                    const updatedPatient = { ...patientForEval, evaluations: updatedEvals };
                    actions.setPatients((prev: any[]) =>
                        prev.map((p) => (p.id === patientForEval.id ? updatedPatient : p))
                    );
                    if (stateRefs.selectedPatient.current?.id === patientForEval.id) {
                        actions.setSelectedPatient(updatedPatient);
                    }
                    await supabase.from("patients").update({ evaluations: updatedEvals }).eq("id", patientForEval.id);
                    setAssistantFeedback(`✓ Evaluación agregada: ${fc.args.score}/${fc.args.maxScore}`);
                    result = { success: true, evaluationId: newEval.id };
                } else {
                    result = { error: "Paciente no encontrado" };
                }
                break;

            case "update_evaluation":
                setAssistantFeedback(`Actualizando evaluación...`);
                const patientForEvalUpdate = findPatient(fc.args.patientName);
                if (patientForEvalUpdate) {
                    const evalToUpdate = patientForEvalUpdate.evaluations?.find((e: any) => e.id === fc.args.evaluationId);
                    if (evalToUpdate) {
                        const updatedEval = {
                            ...evalToUpdate,
                            ...(fc.args.score && { score: Number(fc.args.score) }),
                            ...(fc.args.notes && { notes: fc.args.notes }),
                        };
                        const updatedEvals = patientForEvalUpdate.evaluations.map((e: any) =>
                            e.id === fc.args.evaluationId ? updatedEval : e
                        );
                        const updatedPatient = { ...patientForEvalUpdate, evaluations: updatedEvals };
                        actions.setPatients((prev: any[]) =>
                            prev.map((p) => (p.id === patientForEvalUpdate.id ? updatedPatient : p))
                        );
                        await supabase.from("patients").update({ evaluations: updatedEvals }).eq("id", patientForEvalUpdate.id);
                        setAssistantFeedback(`✓ Evaluación actualizada`);
                        result = { success: true };
                    } else {
                        result = { error: "Evaluación no encontrada" };
                    }
                } else {
                    result = { error: "Paciente no encontrado" };
                }
                break;

            // ===== TREATMENT PLAN =====
            case "update_treatment_plan":
                setAssistantFeedback(`Actualizando plan de tratamiento...`);
                const patientForPlan = findPatient(fc.args.patientName);
                if (patientForPlan) {
                    const updatedPlan = {
                        ...patientForPlan.treatmentPlan,
                        ...(fc.args.general && { general: fc.args.general }),
                        ...(fc.args.specific && { specific: fc.args.specific }),
                        ...(fc.args.strategies && { strategies: fc.args.strategies }),
                    };
                    const updatedPatient = { ...patientForPlan, treatmentPlan: updatedPlan };
                    actions.setPatients((prev: any[]) =>
                        prev.map((p) => (p.id === patientForPlan.id ? updatedPatient : p))
                    );
                    if (stateRefs.selectedPatient.current?.id === patientForPlan.id) {
                        actions.setSelectedPatient(updatedPatient);
                    }
                    await supabase.from("patients").update({ treatmentPlan: updatedPlan }).eq("id", patientForPlan.id);
                    setAssistantFeedback(`✓ Plan de tratamiento actualizado`);
                    result = { success: true };
                } else {
                    result = { error: "Paciente no encontrado" };
                }
                break;

            // ===== EDITOR CONTROL =====
            case "open_editor":
                setAssistantFeedback(`Abriendo editor...`);
                let targetPatient = stateRefs.selectedPatient.current;
                const patientNameArg = fc.args.patientName;
                if (!targetPatient && patientNameArg && patientNameArg !== 'ninguno') {
                    targetPatient = findPatient(patientNameArg);
                    if (targetPatient) {
                        actions.setSelectedPatient(targetPatient);
                        actions.setCurrentView("patients");
                    }
                }
                if (targetPatient) {
                    if (fc.args.type === "treatment_plan") {
                        actions.setEditedPlan(targetPatient.treatmentPlan.strategies || TREATMENT_PLAN_TEMPLATE);
                        actions.setIsEditingPlan(true);
                        setAssistantFeedback(`✓ Editor de plan abierto`);
                    } else {
                        const reportType = fc.args.reportType || "evaluacion";
                        actions.setNewReportType(reportType);
                        const guideKey = reportType === "evaluacion" ? "valoracion" : reportType;
                        const guide = REPORT_GUIDES[guideKey];
                        const defaultContent = guide
                          ? guide.sections.map((s: any) => `<h2>${s.title}</h2>${s.defaultContent || ''}`).join('')
                          : '';
                        actions.setNewReportContent(defaultContent);
                        actions.setShowReportEditor(true);
                        setAssistantFeedback(`✓ Editor de informe abierto`);
                    }
                    result = { success: true };
                } else {
                    result = { error: "Paciente no seleccionado" };
                }
                break;

            case "get_editor_content":
                if (stateRefs.editorRef.current) {
                    const format = fc.args.format || "html";
                    const content = format === "text"
                        ? stateRefs.editorRef.current.getText()
                        : stateRefs.editorRef.current.getHTML();

                    // Limit content length to avoid context overflow
                    const truncated = content.length > 5000 ? content.substring(0, 5000) + "..." : content;

                    setAssistantFeedback(`Leyendo contenido...`);
                    result = { success: true, content: truncated };
                } else {
                    result = { error: "No hay editor activo" };
                }
                break;

            case "write_in_editor":
                const content = fc.args.content;
                const mode = fc.args.mode || "append";
                if (stateRefs.isEditingPlan.current) {
                    if (mode === "replace") {
                        actions.setEditedPlan(content);
                    } else if (mode === "append") {
                        actions.setEditedPlan((prev: string) => prev + content);
                    } else if (mode === "insert") {
                        if (stateRefs.editorRef.current) {
                            stateRefs.editorRef.current.commands.insertContent(content);
                        } else {
                            actions.setEditedPlan((prev: string) => prev + content);
                        }
                    }
                    setAssistantFeedback(`Escribiendo en plan...`);
                } else if (stateRefs.showReportEditor.current) {
                    if (mode === "replace") {
                        actions.setNewReportContent(content);
                    } else if (mode === "append") {
                        actions.setNewReportContent((prev: string) => prev + content);
                    } else if (mode === "insert") {
                        if (stateRefs.editorRef.current) {
                            stateRefs.editorRef.current.commands.insertContent(content);
                        } else {
                            actions.setNewReportContent((prev: string) => prev + content);
                        }
                    }
                    setAssistantFeedback(`Escribiendo en informe...`);
                }
                result = { success: true };
                break;

            case "insert_at_cursor":
                setAssistantFeedback(`Insertando texto...`);
                const insertContent = fc.args.content;
                const formatting = fc.args.formatting || "normal";

                // Format content based on formatting parameter
                let formattedContent = insertContent;
                if (formatting === "bold") {
                    formattedContent = `<strong>${insertContent}</strong>`;
                } else if (formatting === "italic") {
                    formattedContent = `<em>${insertContent}</em>`;
                } else if (formatting === "heading") {
                    formattedContent = `<h3>${insertContent}</h3>`;
                }

                if (stateRefs.editorRef.current) {
                    stateRefs.editorRef.current.commands.insertContent(formattedContent);
                    setAssistantFeedback(`✓ Texto insertado en cursor`);
                } else {
                    // Fallback if ref not available
                    if (stateRefs.isEditingPlan.current) {
                        actions.setEditedPlan((prev: string) => prev + formattedContent);
                    } else if (stateRefs.showReportEditor.current) {
                        actions.setNewReportContent((prev: string) => prev + formattedContent);
                    }
                    setAssistantFeedback(`✓ Texto agregado al final (cursor no detectado)`);
                }
                result = { success: true };
                break;

            case "replace_text":
                setAssistantFeedback(`Buscando y reemplazando...`);
                const searchText = fc.args.searchText;
                const replaceWith = fc.args.replaceWith;
                const replaceAll = fc.args.replaceAll !== false; // default true

                if (stateRefs.isEditingPlan.current) {
                    if (stateRefs.editorRef.current) {
                        // Use editor commands for safer replacement if possible, or just update content
                        // Tiptap doesn't have a simple "replace all" command without custom extensions, 
                        // so we update the state which triggers the useEffect in Editor
                        actions.setEditedPlan((prev: string) => {
                            if (replaceAll) {
                                return prev.split(searchText).join(replaceWith);
                            } else {
                                return prev.replace(searchText, replaceWith);
                            }
                        });
                    } else {
                        actions.setEditedPlan((prev: string) => {
                            if (replaceAll) {
                                return prev.split(searchText).join(replaceWith);
                            } else {
                                return prev.replace(searchText, replaceWith);
                            }
                        });
                    }
                    setAssistantFeedback(`✓ Texto reemplazado en plan`);
                } else if (stateRefs.showReportEditor.current) {
                    actions.setNewReportContent((prev: string) => {
                        if (replaceAll) {
                            return prev.split(searchText).join(replaceWith);
                        } else {
                            return prev.replace(searchText, replaceWith);
                        }
                    });
                    setAssistantFeedback(`✓ Texto reemplazado en informe`);
                } else {
                    result = { error: "No hay editor abierto" };
                    break;
                }
                result = { success: true };
                break;

            case "update_field":
                setAssistantFeedback(`Actualizando campo ${fc.args.field}...`);
                const patientForFieldUpdate = findPatient(fc.args.patientName);
                if (patientForFieldUpdate) {
                    const field = fc.args.field;
                    let value: any = fc.args.value;

                    // Convert value to appropriate type
                    if (field === "age") {
                        value = Number(value);
                    } else if (field === "consentSigned") {
                        value = value === 'true' || value === true;
                    } else if (field === "alerts") {
                        value = typeof value === 'string' ? JSON.parse(value) : value;
                    }

                    const fieldUpdate: any = { [field]: value };
                    let updatedPatient = { ...patientForFieldUpdate, ...fieldUpdate };

                    // Auto-sync alerts with consentSigned
                    if (field === "consentSigned") {
                        updatedPatient.alerts = syncAlertsForConsent(updatedPatient);
                        fieldUpdate.alerts = updatedPatient.alerts;
                    }

                    actions.setPatients((prev: any[]) =>
                        prev.map((p) => (p.id === patientForFieldUpdate.id ? updatedPatient : p))
                    );

                    if (stateRefs.selectedPatient.current?.id === patientForFieldUpdate.id) {
                        actions.setSelectedPatient(updatedPatient);
                    }

                    // Immediate sync to database
                    await supabase.from("patients").update(fieldUpdate).eq("id", patientForFieldUpdate.id);
                    setAssistantFeedback(`✓ ${field} actualizado y sincronizado`);
                    result = { success: true, field, value };
                } else {
                    result = { error: "Paciente no encontrado" };
                }
                break;

            case "save_and_sync":
                setAssistantFeedback(`Guardando cambios...`);
                const closeEditor = fc.args.closeEditor || false;

                if (stateRefs.isEditingPlan.current && stateRefs.selectedPatient.current) {
                    const patient = stateRefs.selectedPatient.current;
                    const updatedPlan = {
                        ...patient.treatmentPlan,
                        strategies: stateRefs.editedPlan.current
                    };
                    const updatedPatient = { ...patient, treatmentPlan: updatedPlan };

                    actions.setPatients((prev: any[]) =>
                        prev.map((p) => (p.id === patient.id ? updatedPatient : p))
                    );
                    actions.setSelectedPatient(updatedPatient);

                    await supabase.from("patients").update({ treatmentPlan: updatedPlan }).eq("id", patient.id);

                    if (closeEditor) {
                        actions.setIsEditingPlan(false);
                    }

                    setAssistantFeedback(`✓ Plan guardado y sincronizado`);
                    result = { success: true, saved: "treatment_plan" };
                } else if (stateRefs.showReportEditor.current && stateRefs.selectedPatient.current) {
                    const patient = stateRefs.selectedPatient.current;
                    const newReport = {
                        id: Date.now().toString(),
                        date: new Date().toISOString().split("T")[0],
                        title: "Informe",
                        content: stateRefs.newReportContent.current,
                        type: "generico" as const
                    };

                    const updatedReports = [...(patient.reports || []), newReport];
                    const updatedPatient = { ...patient, reports: updatedReports };

                    actions.setPatients((prev: any[]) =>
                        prev.map((p) => (p.id === patient.id ? updatedPatient : p))
                    );
                    actions.setSelectedPatient(updatedPatient);

                    await supabase.from("patients").update({ reports: updatedReports }).eq("id", patient.id);

                    if (closeEditor) {
                        actions.setShowReportEditor(false);
                    }

                    setAssistantFeedback(`✓ Informe guardado y sincronizado`);
                    result = { success: true, saved: "report", reportId: newReport.id };
                } else {
                    result = { error: "No hay editor abierto o paciente seleccionado" };
                }
                break;


            // ===== COMMUNICATION & PRODUCTIVITY =====
            case "send_telegram_message":
                setAssistantFeedback(`Enviando mensaje a Telegram...`);
                try {
                    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
                    const res = await fetchWithTimeout(`${backendUrl}/api/telegram/send`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chatId: fc.args.chatId,
                            message: fc.args.message,
                            fileUrl: fc.args.fileUrl
                        })
                    });
                    const data = await res.json();
                    if (data.status === 'ok') {
                        setAssistantFeedback(`✓ Mensaje enviado con éxito`);
                        result = { success: true, sent: data.sent };
                    } else {
                        result = { error: data.message };
                    }
                } catch (e: any) {
                    result = { error: `Error de conexión: ${e.message}` };
                }
                break;

            case "save_to_obsidian":
                setAssistantFeedback(`Guardando en Obsidian...`);
                try {
                    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
                    const res = await fetchWithTimeout(`${backendUrl}/api/obsidian/save`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            path: fc.args.path,
                            content: fc.args.content,
                            title: fc.args.title
                        })
                    });
                    const data = await res.json();
                    if (data.status === 'ok') {
                        setAssistantFeedback(`✓ Guardado en Obsidian`);
                        result = { success: true, path: data.path };
                    } else {
                        result = { error: data.message };
                    }
                } catch (e: any) {
                    result = { error: `Error de conexión: ${e.message}` };
                }
                break;

            case "generate_clinical_summary":
                setAssistantFeedback(`Generando resumen clínico...`);
                const patientForSummary = findPatient(fc.args.patientName);
                if (patientForSummary) {
                    try {
                        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
                        const historyData = patientForSummary.history?.map((h: any) => 
                            `[${h.date}] ${h.type}: ${h.summary} - ${h.observations}`
                        ).join('\n') || "Sin historial disponible.";
                        
                        const res = await fetchWithTimeout(`${backendUrl}/api/clinical_summary`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                patientName: patientForSummary.name,
                                history: historyData,
                                diagnosis: patientForSummary.diagnosis
                            })
                        });
                        const data = await res.json();
                        if (data.status === 'ok') {
                            setAssistantFeedback(`✓ Resumen generado`);
                            result = { success: true, summary: data.response };
                        } else {
                            result = { error: "Error al generar resumen" };
                        }
                    } catch (e: any) {
                        console.error("Error generating summary:", e);
                        result = { error: "Error de conexión con el servidor" };
                    }
                } else {
                    result = { error: "Paciente no encontrado" };
                }
                break;

            case "search_medical_docs":
                setAssistantFeedback(`Buscando en NotebookLM...`);
                try {
                    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
                    const nbsRes = await fetchWithTimeout(`${backendUrl}/api/notebooklm/notebooks?limit=1`);
                    const nbs = await nbsRes.json();
                    const nbList = Array.isArray(nbs) ? nbs : nbs.notebooks || [];
                    if (nbList.length === 0) {
                        result = { error: "No hay notebooks en NotebookLM. Creá uno primero desde el panel." };
                        break;
                    }
                    const nbId = nbList[0].id;
                    const res = await fetchWithTimeout(`${backendUrl}/api/notebooklm/notebooks/${nbId}/ask`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ question: fc.args.query })
                    });
                    const data = await res.json();
                    if (data.answer) {
                        result = { success: true, info: data.answer };
                    } else if (data.error === 'auth_expired') {
                        result = { error: "Sesión de NotebookLM expirada. Ejecutá: python -m notebooklm login" };
                    } else {
                        result = { error: "No se encontraron documentos relevantes" };
                    }
                } catch (e: any) {
                    result = { error: "Error de conexión con NotebookLM" };
                }
                break;

            case "research_scientific_evidence":
                setAssistantFeedback(`Investigando evidencia científica en NotebookLM...`);
                try {
                    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
                    const nbsRes = await fetchWithTimeout(`${backendUrl}/api/notebooklm/notebooks?limit=1`);
                    const nbs = await nbsRes.json();
                    const nbList = Array.isArray(nbs) ? nbs : nbs.notebooks || [];
                    if (nbList.length === 0) {
                        result = { error: "No hay notebooks en NotebookLM. Creá uno desde el panel de NotebookLM." };
                        break;
                    }
                    const nbId = nbList[0].id;
                    const res = await fetchWithTimeout(`${backendUrl}/api/notebooklm/notebooks/${nbId}/ask`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ question: `Evidencia científica sobre: ${fc.args.query}` })
                    });
                    const data = await res.json();
                    if (data.answer) {
                        result = { success: true, evidence: data.answer, references: data.references };
                    } else if (data.error === 'auth_expired') {
                        result = { error: "Sesión de NotebookLM expirada. Conectá desde el panel." };
                    } else {
                        result = { error: "No se encontró evidencia relevante" };
                    }
                } catch (e: any) {
                    result = { error: `Error de conexión: ${e.message}` };
                }
                break;

            // ===== NOTEBOOKLM — CEREBRO DE INVESTIGACIÓN =====
            case "notebook_list":
                setAssistantFeedback(`Listando cuadernos de NotebookLM...`);
                try {
                    const backendUrlNb = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
                    const nbRes = await fetchWithTimeout(`${backendUrlNb}/api/notebooklm/notebooks`);
                    const nbData = await nbRes.json();
                    const nbList = Array.isArray(nbData) ? nbData : nbData.notebooks || [];
                    if (nbList.length === 0) {
                        result = { notebooks: [], message: "No hay cuadernos. Creá uno con notebook_create." };
                    } else {
                        result = { notebooks: nbList.map((n: any) => ({ id: n.id, title: n.title })), total: nbList.length };
                    }
                } catch (e: any) {
                    result = { error: `Error de conexión con NotebookLM: ${e.message}` };
                }
                break;

            case "notebook_create":
                setAssistantFeedback(`Creando cuaderno "${fc.args.title}"...`);
                try {
                    const backendUrlNb2 = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
                    const createRes = await fetchWithTimeout(`${backendUrlNb2}/api/notebooklm/notebooks`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title: fc.args.title })
                    });
                    const createData = await createRes.json();
                    if (createData.id) {
                        result = { success: true, notebookId: createData.id, title: createData.title, message: `Cuaderno "${createData.title}" creado. Agregá fuentes con notebook_add_source.` };
                    } else if (createData.error === 'auth_expired') {
                        result = { error: "Sesión de NotebookLM expirada. Conectá desde el panel de NotebookLM." };
                    } else {
                        result = { error: "No se pudo crear el cuaderno", details: createData };
                    }
                } catch (e: any) {
                    result = { error: `Error de conexión: ${e.message}` };
                }
                break;

            case "notebook_add_source":
                setAssistantFeedback(`Agregando fuente al cuaderno...`);
                try {
                    const backendUrlNb3 = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
                    let nbId = fc.args.notebookId;
                    if (!nbId) {
                        const listRes = await fetchWithTimeout(`${backendUrlNb3}/api/notebooklm/notebooks?limit=1`);
                        const listData = await listRes.json();
                        const list = Array.isArray(listData) ? listData : listData.notebooks || [];
                        nbId = list[0]?.id;
                    }
                    if (!nbId) {
                        result = { error: "No hay cuadernos. Creá uno primero con notebook_create." };
                        break;
                    }
                    const srcRes = await fetchWithTimeout(`${backendUrlNb3}/api/notebooklm/notebooks/${nbId}/sources`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: fc.args.url })
                    });
                    const srcData = await srcRes.json();
                    if (srcData.id || srcData.success) {
                        result = { success: true, notebookId: nbId, sourceId: srcData.id, message: "Fuente agregada. NotebookLM la está procesando." };
                    } else if (srcData.error === 'auth_expired') {
                        result = { error: "Sesión expirada. Conectá desde el panel." };
                    } else {
                        result = { error: "No se pudo agregar la fuente", details: srcData };
                    }
                } catch (e: any) {
                    result = { error: `Error: ${e.message}` };
                }
                break;

            case "notebook_ask":
                setAssistantFeedback(`Consultando NotebookLM...`);
                try {
                    const backendUrlNb4 = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
                    let nbId4 = fc.args.notebookId;
                    if (!nbId4) {
                        const listRes4 = await fetchWithTimeout(`${backendUrlNb4}/api/notebooklm/notebooks?limit=1`);
                        const listData4 = await listRes4.json();
                        const list4 = Array.isArray(listData4) ? listData4 : listData4.notebooks || [];
                        nbId4 = list4[0]?.id;
                    }
                    if (!nbId4) {
                        result = { error: "No hay cuadernos en NotebookLM." };
                        break;
                    }
                    const askRes = await fetchWithTimeout(`${backendUrlNb4}/api/notebooklm/notebooks/${nbId4}/ask`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ question: fc.args.question })
                    });
                    const askData = await askRes.json();
                    if (askData.answer) {
                        result = { success: true, answer: askData.answer, references: askData.references, notebookId: nbId4 };
                    } else if (askData.error === 'auth_expired') {
                        result = { error: "Sesión expirada. Conectá desde el panel." };
                    } else {
                        result = { error: "No se pudo obtener respuesta del cuaderno" };
                    }
                } catch (e: any) {
                    result = { error: `Error: ${e.message}` };
                }
                break;

            case "notebook_generate":
                setAssistantFeedback(`Generando ${fc.args.type} en NotebookLM...`);
                try {
                    const backendUrlNb5 = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
                    let nbId5 = fc.args.notebookId;
                    if (!nbId5) {
                        const listRes5 = await fetchWithTimeout(`${backendUrlNb5}/api/notebooklm/notebooks?limit=1`);
                        const listData5 = await listRes5.json();
                        const list5 = Array.isArray(listData5) ? listData5 : listData5.notebooks || [];
                        nbId5 = list5[0]?.id;
                    }
                    if (!nbId5) {
                        result = { error: "No hay cuadernos en NotebookLM." };
                        break;
                    }
                    const genRes = await fetchWithTimeout(`${backendUrlNb5}/api/notebooklm/notebooks/${nbId5}/generate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: fc.args.type })
                    });
                    const genData = await genRes.json();
                    if (genData.id || genData.success) {
                        result = { success: true, artifactId: genData.id, type: genData.type, message: `Generando ${fc.args.type}. Puedes verificar el estado con notebook_list_artifacts.` };
                    } else if (genData.error === 'auth_expired') {
                        result = { error: "Sesión expirada. Conectá desde el panel." };
                    } else {
                        result = { error: "No se pudo generar el artefacto", details: genData };
                    }
                } catch (e: any) {
                    result = { error: `Error: ${e.message}` };
                }
                break;

            case "notebook_summary":
                setAssistantFeedback(`Obteniendo resumen del cuaderno...`);
                try {
                    const backendUrlNb6 = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
                    let nbId6 = fc.args.notebookId;
                    if (!nbId6) {
                        const listRes6 = await fetchWithTimeout(`${backendUrlNb6}/api/notebooklm/notebooks?limit=1`);
                        const listData6 = await listRes6.json();
                        const list6 = Array.isArray(listData6) ? listData6 : listData6.notebooks || [];
                        nbId6 = list6[0]?.id;
                    }
                    if (!nbId6) {
                        result = { error: "No hay cuadernos en NotebookLM." };
                        break;
                    }
                    const sumRes = await fetchWithTimeout(`${backendUrlNb6}/api/notebooklm/notebooks/${nbId6}/summary`);
                    const sumData = await sumRes.json();
                    if (sumData.summary || sumData.answer) {
                        result = { success: true, summary: sumData.summary || sumData.answer, notebookId: nbId6 };
                    } else if (sumData.error === 'auth_expired') {
                        result = { error: "Sesión expirada. Conectá desde el panel." };
                    } else {
                        result = { error: "No se pudo obtener resumen" };
                    }
                } catch (e: any) {
                    result = { error: `Error: ${e.message}` };
                }
                break;

            case "notebook_list_artifacts":
                setAssistantFeedback(`Listando artefactos del cuaderno...`);
                try {
                    const backendUrlNb7 = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
                    let nbId7 = fc.args.notebookId;
                    if (!nbId7) {
                        const listRes7 = await fetchWithTimeout(`${backendUrlNb7}/api/notebooklm/notebooks?limit=1`);
                        const listData7 = await listRes7.json();
                        const list7 = Array.isArray(listData7) ? listData7 : listData7.notebooks || [];
                        nbId7 = list7[0]?.id;
                    }
                    if (!nbId7) {
                        result = { error: "No hay cuadernos en NotebookLM." };
                        break;
                    }
                    const artRes = await fetchWithTimeout(`${backendUrlNb7}/api/notebooklm/notebooks/${nbId7}/artifacts`);
                    const artData = await artRes.json();
                    const arts = Array.isArray(artData) ? artData : artData.artifacts || [];
                    result = { artifacts: arts.map((a: any) => ({ id: a.id, type: a.type, title: a.title, status: a.status })), total: arts.length, notebookId: nbId7 };
                } catch (e: any) {
                    result = { error: `Error: ${e.message}` };
                }
                break;

            // ===== ANALYTICS & SEARCH =====
            case "search_patients":
                const query = fc.args.query.toLowerCase();
                const matches = stateRefs.patients.current.filter(
                    (p: any) =>
                        p.name.toLowerCase().includes(query) ||
                        p.diagnosis.toLowerCase().includes(query) ||
                        p.notes.toLowerCase().includes(query)
                );
                result = {
                    success: true,
                    matches: matches.map((p: any) => ({
                        name: p.name,
                        diagnosis: p.diagnosis,
                        age: p.age,
                    })),
                    total: matches.length,
                };
                break;

            case "get_statistics": {
                const today2 = new Date().toISOString().split('T')[0];
                const patientsByConsultorio: Record<string, number> = {};
                stateRefs.patients.current.forEach((p: any) => {
                    const c = p.consultorio || p.consultorio_id || 'Sin asignar';
                    patientsByConsultorio[c] = (patientsByConsultorio[c] || 0) + 1;
                });
                result = {
                    success: true,
                    stats: {
                        totalPatients: stateRefs.patients.current.length,
                        totalAppointments: stateRefs.appointments.current.length,
                        pendingAppointments: stateRefs.appointments.current.filter((a: any) => a.date >= today2 && a.status === "pending").length,
                        completedToday: stateRefs.appointments.current.filter((a: any) => a.date === today2 && a.status === "completed").length,
                        patientsWithoutDocument: stateRefs.patients.current.filter((p: any) => !p.document).length,
                        patientsWithoutPhone: stateRefs.patients.current.filter((p: any) => !p.phone).length,
                        patientsByConsultorio,
                    },
                };
                break;
            }

            case "generate_plan_suggestions":
                setAssistantFeedback(`Generando sugerencias IA...`);
                actions.handleGeneratePlanSuggestions();
                result = { success: true };
                break;

            case "export_to_obsidian":
                setAssistantFeedback(`Enviando a Obsidian...`);
                const targetPatientObsidian = stateRefs.selectedPatient.current;
                if (targetPatientObsidian) {
                    await actions.sendPatientToObsidian(targetPatientObsidian);
                    result = { success: true };
                } else {
                    result = { error: "Paciente no seleccionado" };
                }
                break;

            case "check_missing_data":
                if (fc.args.patientName) {
                    const singlePatient = findPatient(fc.args.patientName);
                    if (singlePatient) {
                        const fields = getMissingFieldsFor(singlePatient);
                        if (fields.length > 0) {
                            setAssistantFeedback(`Faltan datos de ${singlePatient.name}: ${fields.join(', ')}`);
                        } else {
                            setAssistantFeedback(`✓ Todos los datos de ${singlePatient.name} están completos`);
                        }
                        result = { success: true, patient: singlePatient.name, missingFields: fields };
                    } else {
                        result = { error: `Paciente "${fc.args.patientName}" no encontrado` };
                    }
                } else {
                    const missing = stateRefs.patients.current
                        .filter((p: any) => getMissingFieldsFor(p).length > 0)
                        .map((p: any) => ({
                            name: p.name,
                            missingFields: getMissingFieldsFor(p),
                        }));
                    setAssistantFeedback(`Se encontraron ${missing.length} pacientes con datos faltantes`);
                    result = { success: true, patientsWithMissingData: missing, total: missing.length };
                }
                break;

            // ===== KNOWLEDGE BASE =====
            case "search_knowledge":
                // Implementation placeholder
                result = { error: "Búsqueda de conocimiento no implementada" };
                break;
            case "add_knowledge":
                setAssistantFeedback(`Guardando conocimiento...`);
                const { error: addError } = await supabase
                    .from('assistant_knowledge')
                    .insert([{
                        title: fc.args.title,
                        content: fc.args.content,
                        tags: fc.args.tags || []
                    }]);

                if (addError) {
                    result = { error: `Error guardando conocimiento: ${addError.message}` };
                } else {
                    setAssistantFeedback(`✓ Conocimiento guardado`);
                    result = { success: true };
                }
                break;
            case "add_material":
                setAssistantFeedback(`Añadiendo recurso a la biblioteca...`);
                const newMat = { ...fc.args, id: Date.now().toString() };
                try {
                    if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
                        await supabase.from('materials').insert([newMat]);
                    }
                    actions.setMaterials((prev: any[]) => [...prev, newMat]);
                    setAssistantFeedback(`✓ Recurso "${newMat.title}" añadido`);
                    result = { success: true };
                } catch (e: any) {
                    result = { error: `Error añadiendo recurso: ${e.message}` };
                }
                break;
            case "update_material":
                setAssistantFeedback(`Actualizando recurso...`);
                try {
                    if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
                        await supabase.from('materials').update(fc.args).eq('id', fc.args.id);
                    }
                    actions.setMaterials((prev: any[]) => prev.map(m => m.id === fc.args.id ? { ...m, ...fc.args } : m));
                    setAssistantFeedback(`✓ Recurso actualizado`);
                    result = { success: true };
                } catch (e: any) {
                    result = { error: `Error actualizando recurso: ${e.message}` };
                }
                break;
            case "delete_material":
                setAssistantFeedback(`Eliminando recurso...`);
                try {
                    if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
                        await supabase.from('materials').delete().eq('id', fc.args.id);
                    }
                    actions.setMaterials((prev: any[]) => prev.filter(m => m.id !== fc.args.id));
                    setAssistantFeedback(`✓ Recurso eliminado`);
                    result = { success: true };
                } catch (e: any) {
                    result = { error: `Error eliminando recurso: ${e.message}` };
                }
                break;
            case "sync_materials_from_drive":
                setAssistantFeedback(`Sincronizando materiales desde Google Drive...`);
                try {
                    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
                    const res = await fetchWithTimeout(`${backendUrl}/api/google/drive/sync`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ folderId: fc.args.folderId || '' })
                    });
                    const data = await res.json();
                    if (data.status === 'ok' && data.materials?.length) {
                        if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
                            for (const mat of data.materials) {
                                await supabase.from('materials').insert([mat]).catch(() => {});
                            }
                        }
                        // Update local state to avoid reload
                        actions.setMaterials(prev => {
                            const existingTitles = new Set(prev.map((m: any) => m.title));
                            const uniqueNew = data.materials.filter((m: any) => !existingTitles.has(m.title));
                            return [...prev, ...uniqueNew];
                        });
                        setAssistantFeedback(`✓ ${data.count} materiales sincronizados`);
                        result = { success: true, count: data.count };
                    } else {
                        result = { error: "No se encontraron nuevos materiales en Drive" };
                    }
                } catch (e: any) {
                    result = { error: `Error de conexión con Drive: ${e.message}` };
                }
                break;

             case "send_material_to_caregiver":
                 setAssistantFeedback(`Preparando envío de material para ${fc.args.patientName}...`);
                 try {
                     const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
                     const res = await fetchWithTimeout(`${backendUrl}/api/external-distribution`, {
                         method: 'POST',
                         headers: { 'Content-Type': 'application/json' },
                         body: JSON.stringify({
                             patientName: fc.args.patientName,
                             materialTitle: fc.args.materialTitle,
                             recipientContact: fc.args.recipientContact,
                             medium: fc.args.medium,
                             message: fc.args.message || `Hola, te envío el material: ${fc.args.materialTitle}`
                         }),
                     });
                     const data = await res.json();
                     if (data.status === 'ok') {
                         setAssistantFeedback(`✓ Material enviado con éxito vía ${fc.args.medium}`);
                         result = { success: true, ...data };
                     } else {
                         setAssistantFeedback(`✗ Error al enviar: ${data.message}`);
                         result = { error: data.message };
                     }
                 } catch (e: any) {
                     setAssistantFeedback(`✗ Error de conexión al enviar material`);
                     result = { error: `Error de conexión: ${e.message}` };
                 }
                 break;

             case "resend_last_material":
                 setAssistantFeedback(`Reenviando último material para ${fc.args.patientName || 'el paciente'}...`);
                 try {
                     const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
                     const res = await fetchWithTimeout(`${backendUrl}/api/resend_last_material`, {
                         method: 'POST',
                         headers: { 'Content-Type': 'application/json' },
                         body: JSON.stringify({ patientId: fc.args.patientId || stateRefs.selectedPatient.current?.id }),
                     });
                     const data = await res.json();
                     if (data.status === 'ok') {
                         setAssistantFeedback(`✓ Reenvío completado`);
                         result = { success: true };
                     } else {
                         setAssistantFeedback(`✗ Error en reenvío: ${data.message}`);
                         result = { error: data.message };
                     }
                 } catch (e: any) {
                     setAssistantFeedback(`✗ Error al reenviar`);
                     result = { error: e.message };
                 }
                 break;

             case "schedule_reminder":
                 setAssistantFeedback(`Programando recordatorio...`);
                 try {
                     const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
                     const res = await fetchWithTimeout(`${backendUrl}/api/schedule_reminder`, {
                         method: 'POST',
                         headers: { 'Content-Type': 'application/json' },
                         body: JSON.stringify({
                             patientId: fc.args.patientId || stateRefs.selectedPatient.current?.id,
                             materialTitle: fc.args.materialTitle,
                             recipientContact: fc.args.recipientContact,
                             medium: fc.args.medium,
                             scheduledAt: fc.args.scheduledAt
                         }),
                     });
                     const data = await res.json();
                     if (data.status === 'ok') {
                         setAssistantFeedback(`✓ Recordatorio programado`);
                         result = { success: true };
                     } else {
                         setAssistantFeedback(`✗ Error al programar: ${data.message}`);
                         result = { error: data.message };
                     }
                 } catch (e: any) {
                     setAssistantFeedback(`✗ Error al programar recordatorio`);
                     result = { error: e.message };
                 }
                 break;


            default:
                result = { error: `Herramienta desconocida: ${fc.name}` };
        }
    } catch (e: any) {
        console.error(`Error en herramienta ${fc.name}:`, e);
        result = { error: `Error ejecutando ${fc.name}: ${e.message}` };
    }

    return result;
}
