import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

/**
 * TipTap extension that highlights [VARIABLE] placeholders in the editor.
 * Red dashed background for unfilled variables like [NOMBRE], [EDAD], etc.
 */

const VARIABLE_REGEX = /\[([A-Z_]+(?:\d)?)\]/g;

const VARIABLE_LABELS: Record<string, string> = {
    NOMBRE: 'Nombre del paciente',
    EDAD: 'Edad',
    DIAGNOSTICO: 'Diagnóstico',
    FECHA: 'Fecha',
    DOCUMENTO: 'Documento',
    RESPONSABLE: 'Responsable',
    OBRA_SOCIAL: 'Obra Social',
    DERIVANTE: 'Derivante',
    GENERO: 'Sexo',
    FECHA_NACIMIENTO: 'Fecha de Nacimiento',
    CANTIDAD_SESIONES: 'Cantidad de Sesiones',
    FECHA_VALORACION: 'Fecha de Valoración',
    MODALIDAD: 'Modalidad',
    PARENTESTCO_INFORMANTE: 'Parentesco',
    INFORMANTE_NOMBRE: 'Nombre Informante',
    MOTIVO_TEXTO: 'Detalle del Motivo',
    ESTRUCTURA_EJEMPLO: 'Ej. de Oración',
    DESCRIPCION_EDAD: 'Descripción Esperada',
    CANTIDAD_PALABRAS: 'Cantidad de Palabras',
    HABILIDADES_COMPRENSION: 'Habilidades',
    DIFICULTADES_COMPRENSION: 'Dificultades',
    PROCESOS_SIMPLIFICACION: 'Procesos de Simplificación',
    DIAGNOSTICO_FONOAUDIOLOGICO: 'Diagnóstico Fonoaudiológico',
    AREAS_AFECTADAS: 'Áreas Afectadas',
    JUEGO_PREFERIDO: 'Juego Preferido',
    JUEGO_MENOR_INTERES: 'Juego de Menor Interés',
    FRECUENCIA_TERAPIA: 'Frecuencia de Terapia',
    FECHA_INICIO_TRATAMIENTO: 'Fecha de Inicio',
    SESIONES_REALIZADAS: 'Sesiones Realizadas',
};

const pluginKey = new PluginKey('variableHighlight');

function getDecorations(doc: any) {
    const decorations: Decoration[] = [];

    doc.descendants((node: any, pos: number) => {
        if (!node.isText) return true;

        const text = node.text || '';
        let match;

        VARIABLE_REGEX.lastIndex = 0;

        while ((match = VARIABLE_REGEX.exec(text)) !== null) {
            const varName = match[1];
            const start = pos + match.index;
            const end = start + match[0].length;

            decorations.push(
                Decoration.inline(start, end, {
                    class: 'variable-placeholder variable-unfilled',
                    'data-variable': varName,
                    'data-label': VARIABLE_LABELS[varName] || varName,
                } as any)
            );
        }
        return true;
    });

    return DecorationSet.create(doc, decorations);
}

export const VariableHighlight = Extension.create({
    name: 'variableHighlight',

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: pluginKey,
                state: {
                    init: (_, state) => getDecorations(state.doc),
                    apply: (tr, old, oldState, newState) => {
                        if (!tr.docChanged) return old;
                        return getDecorations(newState.doc);
                    },
                },
                props: {
                    decorations(state) {
                        return pluginKey.getState(state) || DecorationSet.empty;
                    },
                },
            }),
        ];
    },
});
