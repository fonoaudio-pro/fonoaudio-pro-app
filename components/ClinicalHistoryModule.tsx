import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import {
  Clock,
  FileText,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Brain,
  Ear,
  Heart,
  Mic,
  MessageSquare
} from 'lucide-react';
import {
  ClinicalEvolutionEntry,
  ClinicalAxis,
  AxisSnapshot,
  CLINICAL_AXES
} from '../types/clinical_history';
import { ClinicalEvolutionService } from '../services/ClinicalEvolutionService';
import { AnamnesisService } from '../services/AnamnesisService';
import { adaptResponseToSections, adaptResponseToLegacyJson } from '../utils/anamnesisAdapter';
import { supabase } from '../utils/supabaseClient';
import { AdaptiveAnamnesisForm } from './AdaptiveAnamnesisForm';
import { useClinicalAlerts } from '../context/ClinicalAlertBus';
import { useToast } from '../context/ToastContext';

const AXIS_ICONS: Record<ClinicalAxis, React.ReactNode> = {
  voz: <Mic className="w-4 h-4" />,
  lenguaje: <MessageSquare className="w-4 h-4" />,
  deglucion: <Heart className="w-4 h-4" />,
  audicion: <Ear className="w-4 h-4" />,
  motricidad_orofacial: <Activity className="w-4 h-4" />,
  cognicion: <Brain className="w-4 h-4" />
};

const RISK_COLORS: Record<string, string> = {
  normal: 'bg-green-100 text-green-800',
  bajo: 'bg-blue-100 text-blue-800',
  moderado: 'bg-yellow-100 text-yellow-800',
  alto: 'bg-orange-100 text-orange-800',
  critico: 'bg-red-100 text-red-800'
};

const TREND_ICONS: Record<string, React.ReactNode> = {
  improving: <TrendingUp className="w-4 h-4 text-green-500" />,
  stable: <Minus className="w-4 h-4 text-gray-500" />,
  worsening: <TrendingDown className="w-4 h-4 text-red-500" />,
  inconsistent: <AlertTriangle className="w-4 h-4 text-yellow-500" />
};

const SOURCE_LABELS: Record<string, string> = {
  clinical_record: 'Ficha Clínica',
  anamnesis: 'Anamnesis',
  evolution_entry: 'Evolución',
  daily_record: 'Registro Diario',
  session: 'Sesión',
  assessment: 'Evaluación',
  observation: 'Observación',
  manual: 'Manual'
};

interface ClinicalHistoryModuleProps {
  patientId: string;
  patientName: string;
  birthDate: string;
  motivoConsulta: string;
  onClose?: () => void;
}

export const ClinicalHistoryModule: React.FC<ClinicalHistoryModuleProps> = ({
  patientId,
  patientName,
  birthDate,
  motivoConsulta,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState('evolution');
  const [evolutionEntries, setEvolutionEntries] = useState<ClinicalEvolutionEntry[]>([]);
  const [axisSnapshots, setAxisSnapshots] = useState<Record<ClinicalAxis, AxisSnapshot>>({} as Record<ClinicalAxis, AxisSnapshot>);
  const [selectedAxis, setSelectedAxis] = useState<ClinicalAxis>('lenguaje');
  const [isLoading, setIsLoading] = useState(true);
  const [showAnamnesisForm, setShowAnamnesisForm] = useState(false);
  const { getAlerts } = useClinicalAlerts();
  const { addToast } = useToast();
  const patientAlerts = getAlerts({ patientId });

  useEffect(() => {
    loadClinicalData();
  }, [patientId]);

  const loadClinicalData = async () => {
    setIsLoading(true);
    try {
      const [entries, snapshots] = await Promise.all([
        ClinicalEvolutionService.getEvolutionEntries(patientId),
        ClinicalEvolutionService.getPatientSnapshotSummary(patientId)
      ]);
      setEvolutionEntries(entries);
      setAxisSnapshots(snapshots);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAnamnesis = async (response: any) => {
    let anamnesisSaved = false;
    const errors: string[] = [];

    // 1. Evolution entry (optional, best-effort)
    try {
      const result = await ClinicalEvolutionService.addEvolutionEntry({
        patientId,
        axis: response.affectedAreas?.[0] || 'lenguaje',
        date: new Date().toISOString(),
        source: 'anamnesis',
        signs: Object.entries(response.answers)
          .filter(([_, value]) => value !== undefined && value !== null && value !== '')
          .map(([key, value]) => `${key}: ${value}`),
        measures: response.answers,
        riskLevel: 'normal',
        notes: `Anamnesis adaptativa completada - ${response.metadata?.ageGroup || ''}`,
        actions: ['Seguimiento según hallazgos'],
        status: 'active'
      });
      if (!result) errors.push('No se pudo guardar el registro de evolución');
    } catch (err: any) {
      console.error('[ClinicalHistoryModule] Error saving evolution entry:', err);
      errors.push('Error en evolución clínica');
    }

    // 2. Anamnesis table (CRITICAL)
    try {
      const sections = adaptResponseToSections(response);
      await AnamnesisService.saveAsNewDraft(patientId, sections);
      anamnesisSaved = true;
    } catch (err: any) {
      console.error('[ClinicalHistoryModule] Error saving to patient_anamnesis:', err);
      errors.push(`Anamnesis: ${err?.message || err}`);
    }

    // 3. Legacy jsonb (optional)
    try {
      const legacyJson = adaptResponseToLegacyJson(response);
      const { error } = await supabase
        .from('patients')
        .update({ anamnesis: legacyJson })
        .eq('id', patientId);
      if (error) {
        console.error('[ClinicalHistoryModule] Legacy update error:', error);
        errors.push(`Legacy: ${error.message}`);
      }
    } catch (err: any) {
      console.error('[ClinicalHistoryModule] Error updating patients.anamnesis:', err);
      errors.push(`Legacy: ${err?.message || err}`);
    }

    if (anamnesisSaved) {
      addToast({
        message: errors.length > 0
          ? `Anamnesis guardada (${errors.length} warning(s)). Revisá consola.`
          : 'Anamnesis guardada correctamente',
        type: errors.length > 0 ? 'warning' : 'success'
      });
      setShowAnamnesisForm(false);
      loadClinicalData();
      return true;
    } else {
      addToast({
        message: `Error al guardar anamnesis: ${errors.join('; ')}`,
        type: 'error'
      });
      return false;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  if (showAnamnesisForm) {
    return (
      <div className="h-full">
        <AdaptiveAnamnesisForm
          patientId={patientId}
          patientName={patientName}
          birthDate={birthDate}
          motivoConsulta={motivoConsulta}
          onSave={handleSaveAnamnesis}
          onCancel={() => setShowAnamnesisForm(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="text-lg font-semibold">Historia Clínica Inteligente</h2>
          <p className="text-sm text-muted-foreground">{patientName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowAnamnesisForm(true)}
          >
            <FileText className="w-4 h-4 mr-2" />
            Nueva Anamnesis
          </Button>
          {onClose && (
            <Button variant="ghost" onClick={onClose}>
              Cerrar
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-4">
          <TabsTrigger value="evolution">Línea de Tiempo</TabsTrigger>
          <TabsTrigger value="axes">Ejes Clínicos</TabsTrigger>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
        </TabsList>

        <TabsContent value="evolution" className="flex-1 overflow-hidden">
          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="p-4 space-y-4">
              {evolutionEntries.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Sin entradas de evolución</p>
                  <Button
                    variant="link"
                    onClick={() => setShowAnamnesisForm(true)}
                    className="mt-2"
                  >
                    Crear primera entrada
                  </Button>
                </div>
              ) : (
                evolutionEntries.map((entry) => (
                  <Card key={entry.id} className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
                    <CardHeader className="pl-8">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {AXIS_ICONS[entry.axis]}
                          <CardTitle className="text-sm">
                            {ClinicalEvolutionService.getAxisLabel(entry.axis)}
                          </CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={RISK_COLORS[entry.riskLevel] || ''}>
                            {entry.riskLevel}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(entry.date)}
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pl-8">
                      <div className="text-xs text-muted-foreground mb-2">
                        Fuente: {SOURCE_LABELS[entry.source] || entry.source}
                      </div>
                      {entry.signs.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {entry.signs.slice(0, 3).map((sign, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {sign.length > 30 ? sign.substring(0, 30) + '...' : sign}
                            </Badge>
                          ))}
                          {entry.signs.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{entry.signs.length - 3} más
                            </Badge>
                          )}
                        </div>
                      )}
                      {entry.notes && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {entry.notes}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="axes" className="flex-1 overflow-hidden">
          <div className="flex h-full">
            <div className="w-48 border-r p-4">
              <h3 className="font-medium mb-4">Ejes</h3>
              <div className="space-y-2">
                {CLINICAL_AXES.map((axis) => (
                  <button
                    key={axis}
                    onClick={() => setSelectedAxis(axis)}
                    className={`w-full text-left p-3 rounded-lg transition-colors flex items-center gap-2 ${
                      selectedAxis === axis
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    {AXIS_ICONS[axis]}
                    <span className="text-sm">{ClinicalEvolutionService.getAxisLabel(axis)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 p-4">
              {axisSnapshots[selectedAxis] ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>
                        {ClinicalEvolutionService.getAxisLabel(selectedAxis)}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {TREND_ICONS[axisSnapshots[selectedAxis].trend]}
                        <Badge className={RISK_COLORS[axisSnapshots[selectedAxis].currentRisk]}>
                          {axisSnapshots[selectedAxis].currentRisk}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-medium text-sm mb-2">Hallazgos Principales</h4>
                      {axisSnapshots[selectedAxis].keyFindings.length > 0 ? (
                        <ul className="space-y-1">
                          {axisSnapshots[selectedAxis].keyFindings.map((finding, i) => (
                            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                              <span className="text-xs mt-1">•</span>
                              {finding}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">Sin hallazgos registrados</p>
                      )}
                    </div>

                    <Separator />

                    <div>
                      <h4 className="font-medium text-sm mb-2">Acciones Pendientes</h4>
                      {axisSnapshots[selectedAxis].pendingActions.length > 0 ? (
                        <ul className="space-y-1">
                          {axisSnapshots[selectedAxis].pendingActions.map((action, i) => (
                            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5" />
                              {action}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">Sin acciones pendientes</p>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Última actualización: {formatDate(axisSnapshots[selectedAxis].lastUpdated)}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="text-center py-12">
                  <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Sin datos para este eje</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="flex-1 overflow-hidden p-4">
          {patientAlerts.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Sin alertas activas</p>
              <p className="text-xs text-muted-foreground mt-2">
                Las alertas aparecerán automáticamente al completar anamnesis
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="space-y-4">
                {patientAlerts.map((alert) => (
                  <Card key={alert.id} className={
                    alert.severity === 'critical' ? 'border-red-500 bg-red-50 dark:bg-red-950' :
                    alert.severity === 'high' ? 'border-orange-500 bg-orange-50 dark:bg-orange-950' :
                    ''
                  }>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{alert.title}</CardTitle>
                        <Badge className={
                          alert.severity === 'critical' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                          alert.severity === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                          alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                          'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        }>
                          {alert.severity}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-2">{alert.description}</p>
                      {alert.suggestedAction && (
                        <p className="text-xs text-blue-600">
                          <strong>Acción sugerida:</strong> {alert.suggestedAction}
                        </p>
                      )}
                      {alert.evidence && (
                        <p className="text-xs text-muted-foreground mt-2">
                          <strong>Evidencia:</strong> {alert.evidence}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
