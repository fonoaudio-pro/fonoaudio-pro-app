import { google } from 'googleapis';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '';
const DRIVE_MATERIALS_EXTENSIONS = ['pdf', 'mp4', 'webm', 'avi', 'mov', 'jpg', 'png', 'doc', 'docx'];

let calendarService = null;
let driveService = null;
let auth = null;

// Try service account first, fall back to OAuth 2.0 with refresh token
if (GOOGLE_API_KEY && GOOGLE_CLIENT_EMAIL && GOOGLE_PRIVATE_KEY) {
    auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: GOOGLE_CLIENT_EMAIL,
            private_key: GOOGLE_PRIVATE_KEY,
        },
        scopes: [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/drive.readonly',
        ],
    });

    calendarService = google.calendar({ version: 'v3', auth });
    driveService = google.drive({ version: 'v3', auth });
    console.log('[Google Service] Service Account configured successfully');
} else if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REFRESH_TOKEN) {
    const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
    oauth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
    auth = oauth2Client;

    calendarService = google.calendar({ version: 'v3', auth });
    driveService = google.drive({ version: 'v3', auth });
    console.log('[Google Service] OAuth 2.0 configured via refresh token');
} else {
    console.warn('[Google Service] Missing Google credentials. Using fallback simulation.');
}

export async function createGoogleMeetEvent(appointment) {
    const { patientName, date, time, durationMinutes = 30, description = 'Teleatención Fonoaudiológica' } = appointment;

    if (!calendarService) {
        console.warn('[Google Service] Calendar service not configured. Returning simulated link.');
        return {
            status: 'ok',
            meetLink: `https://meet.google.com/${Math.random().toString(36).substring(7)}-${Math.random().toString(36).substring(7)}-${Math.random().toString(36).substring(7).toUpperCase()}`,
            eventId: null,
            simulated: true,
        };
    }

    try {
        const eventDateTime = `${date}T${time}:00`;
        const endTime = new Date(new Date(eventDateTime).getTime() + durationMinutes * 60000);
        const endDateTime = endTime.toISOString().replace(/-|:|\.\d{3}/g, '');

        const event = await calendarService.events.insert({
            calendarId: GOOGLE_CALENDAR_ID,
            resourceId: `event-${patientName.replace(/\s/g, '-')}-${date}`,
            sendUpdates: 'all',
            body: {
                summary: `Consulta: ${patientName}`,
                description: `${description}\n\nPaciente: ${patientName}`,
                start: { dateTime: eventDateTime, timeZone: 'America/Argentina/Buenos_Aires' },
                end: { dateTime: endDateTime, timeZone: 'America/Argentina/Buenos_Aires' },
                conferenceData: {
                    createRequest: {
                        requestId: `fono-${patientName.replace(/\s/g, '-')}-${date}`,
                        conferenceSolutionKey: { type: 'hangoutsMeet' },
                    },
                },
                reminders: {
                    useDefault: false,
                    overrides: [
                        { method: 'email', minutes: 60 },
                        { method: 'popup', minutes: 15 },
                    ],
                },
            },
        });

        const meetLink = event.data.hangoutLink || event.data.conferenceData?.entryPoints?.[0]?.uri;

        return {
            status: 'ok',
            meetLink,
            eventId: event.data.id,
            simulated: false,
        };
    } catch (error) {
        console.error('[Google Service] Error creating event:', error);
        return {
            status: 'error',
            message: error.message,
            simulated: false,
        };
    }
}

export async function syncGoogleCalendar() {
    if (!calendarService) {
        console.warn('[Google Service] Calendar service not configured. Returning simulated sync.');
        return {
            status: 'ok',
            appointments: [
                { patient: "Mateo Rodríguez", date: "2026-05-28", time: "10:00", type: "Consulta Virtual", meetLink: "https://meet.google.com/abc-defg-hij" },
                { patient: "Sofía Martínez", date: "2026-05-29", time: "14:30", type: "Terapia de Voz", meetLink: "https://meet.google.com/xyz-wvu-ts" },
            ],
            simulated: true,
        };
    }

    try {
        const now = new Date();
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const response = await calendarService.events.list({
            calendarId: GOOGLE_CALENDAR_ID,
            timeMin: now.toISOString(),
            timeMax: nextWeek.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
        });

        const events = response.data.items || [];

        return {
            status: 'ok',
            appointments: events.map(event => ({
                patient: event.summary?.replace('Consulta: ', '') || 'Sin título',
                date: event.start?.dateTime?.split('T')[0] || event.start?.date || '',
                time: event.start?.dateTime?.split('T')[1]?.slice(0, 5) || '',
                type: event.description?.split('\n')[0] || 'Consulta',
                meetLink: event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri,
            })),
            simulated: false,
        };
    } catch (error) {
        console.error('[Google Service] Error syncing calendar:', error);
        return {
            status: 'error',
            message: error.message,
            simulated: false,
        };
    }
}

export async function listDriveFiles(folderId) {
    if (!driveService) {
        console.warn('[Google Service] Drive service not configured. Returning simulated files.');
        return {
            status: 'ok',
            files: [
                { id: 'sim1', name: 'Desarrollo del Lenguaje Infantil - Monfort.pdf', mimeType: 'application/pdf', size: '2457600', modifiedTime: new Date().toISOString(), webViewLink: '#' },
                { id: 'sim2', name: 'Disfagia Neurogénica Clínica - Castelli.pdf', mimeType: 'application/pdf', size: '4194304', modifiedTime: new Date().toISOString(), webViewLink: '#' },
            ],
            simulated: true,
        };
    }

    try {
        const query = folderId
            ? `'${folderId}' in parents and trashed=false`
            : "trashed=false and (mimeType='application/pdf' or mimeType contains 'video/' or mimeType contains 'image/' or mimeType='application/msword' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document')";

        const response = await driveService.files.list({
            q: query,
            fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink, thumbnailLink)',
            orderBy: 'modifiedTime desc',
            pageSize: 100,
        });

        return {
            status: 'ok',
            files: response.data.files || [],
            simulated: false,
        };
    } catch (error) {
        console.error('[Google Service] Error listing Drive files:', error);
        return {
            status: 'error',
            message: error.message,
            files: [],
        };
    }
}

export async function syncDriveToMaterials(folderId) {
    const result = await listDriveFiles(folderId || DRIVE_FOLDER_ID);
    if (result.status !== 'ok') return result;

    const categoryMap = {
        'application/pdf': 'PDF',
        'video/mp4': 'Video',
        'video/webm': 'Video',
        'video/x-msvideo': 'Video',
        'video/quicktime': 'Video',
        'image/jpeg': 'Imagen',
        'image/png': 'Imagen',
        'application/msword': 'Documento',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Documento',
    };

    const materials = result.files.map((file) => {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const area = file.name.includes('Lenguaje') || file.name.includes('TEL') ? 'Lenguaje'
            : file.name.includes('Disfagia') || file.name.includes('Deglución') ? 'Disfagia'
            : file.name.includes('Voz') ? 'Voz'
            : file.name.includes('Habla') || file.name.includes('Fon') ? 'Habla'
            : file.name.includes('Audición') || file.name.includes('Audio') ? 'Audición'
            : 'General';

        return {
            title: file.name.replace(/\.[^/.]+$/, ''),
            category: area,
            type: 'drive',
            format: categoryMap[file.mimeType] || ext.toUpperCase(),
            url: file.webViewLink || '#',
            verified: false,
            driveFileId: file.id,
            driveMimeType: file.mimeType,
            fileSize: file.size,
            modifiedAt: file.modifiedTime,
        };
    });

    return {
        status: 'ok',
        materials,
        count: materials.length,
        simulated: result.simulated,
    };
}

export default {
    createGoogleMeetEvent,
    syncGoogleCalendar,
    listDriveFiles,
    syncDriveToMaterials,
};
