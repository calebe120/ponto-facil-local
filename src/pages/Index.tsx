import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Clock, Users, Download, Trash2, Calendar, Edit, LogOut, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import logoCvc from "@/assets/logo-cvc.jpeg";

interface TimeRecord {
  id: string;
  user_id: string;
  employee_name: string;
  date: string;
  entry_time: string | null;
  lunch_exit_time: string | null;
  lunch_return_time: string | null;
  exit_time: string | null;
  total_hours: string | null;
  created_at?: string;
  updated_at?: string;
}

const Index = () => {
  const navigate = useNavigate();
  const { user, session, role, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [filterDate, setFilterDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [editingRecord, setEditingRecord] = useState<TimeRecord | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editPassword, setEditPassword] = useState("");
  const [editFormData, setEditFormData] = useState({
    entry_time: "",
    lunch_exit_time: "",
    lunch_return_time: "",
    exit_time: "",
  });
  const [clearPassword, setClearPassword] = useState("");
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false);
  const [periodStartDate, setPeriodStartDate] = useState("");
  const [periodEndDate, setPeriodEndDate] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [recordToDelete, setRecordToDelete] = useState<TimeRecord | null>(null);
  const [employeeName, setEmployeeName] = useState("");
  const [manualEntryDialogOpen, setManualEntryDialogOpen] = useState(false);
  const [manualEntryData, setManualEntryData] = useState({
    date: "",
    entry_time: "",
    lunch_exit_time: "",
    lunch_return_time: "",
    exit_time: "",
  });

  // Auth check
  useEffect(() => {
    if (!authLoading) {
      if (!session) {
        navigate("/auth");
      } else {
        // Get employee name from user metadata
        setEmployeeName(session.user.user_metadata?.employee_name || session.user.email || "");
        setLoading(false);
      }
    }
  }, [authLoading, session, navigate]);

  // Load records from database
  useEffect(() => {
    if (user) {
      loadRecords();
    }
  }, [user]);

  const loadRecords = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("time_records")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      if (error) throw error;

      setRecords(data || []);
    } catch (error: any) {
      console.error("Error loading records:", error);
      toast.error("Erro ao carregar registros");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getCurrentTime = () => {
    const now = new Date();
    return now.toTimeString().slice(0, 5);
  };

  const timeToMinutes = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };

  const calculateTotalHours = (
    entryTime: string | null, 
    lunchExitTime: string | null, 
    lunchReturnTime: string | null, 
    exitTime: string | null
  ): { total: string; overtime: boolean } => {
    if (!entryTime || !exitTime) {
      return { total: "--:--", overtime: false };
    }

    const entrada = timeToMinutes(entryTime);
    const saida = timeToMinutes(exitTime);
    
    let totalMinutes = saida - entrada;
    
    // Subtract actual lunch break time if both times are provided
    if (lunchExitTime && lunchReturnTime) {
      const lunchExit = timeToMinutes(lunchExitTime);
      const lunchReturn = timeToMinutes(lunchReturnTime);
      const lunchBreakMinutes = lunchReturn - lunchExit;
      totalMinutes -= lunchBreakMinutes;
    } else {
      // Default: subtract 1 hour lunch break
      totalMinutes -= 60;
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    const overtime = totalMinutes > 528; // 8h48min = 528 minutes (Brazilian standard: 44h per week / 5 days)

    return {
      total: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
      overtime,
    };
  };

  const calculateBalance = (recordsList: TimeRecord[]) => {
    let totalBalanceMinutes = 0;
    
    recordsList.forEach((record) => {
      if (!record.entry_time || !record.exit_time) return;
      
      const entrada = timeToMinutes(record.entry_time);
      const saida = timeToMinutes(record.exit_time);
      let workedMinutes = saida - entrada;
      
      // Subtract actual lunch break time if both times are provided
      if (record.lunch_exit_time && record.lunch_return_time) {
        const lunchExit = timeToMinutes(record.lunch_exit_time);
        const lunchReturn = timeToMinutes(record.lunch_return_time);
        const lunchBreakMinutes = lunchReturn - lunchExit;
        workedMinutes -= lunchBreakMinutes;
      } else {
        workedMinutes -= 60; // Default lunch break
      }
      
      // 528 minutes = 8h48min (Brazilian standard: 44h per week / 5 days)
      totalBalanceMinutes += (workedMinutes - 528);
    });
    
    const isPositive = totalBalanceMinutes >= 0;
    const absMinutes = Math.abs(totalBalanceMinutes);
    const hours = Math.floor(absMinutes / 60);
    const minutes = absMinutes % 60;
    
    return {
      formatted: `${isPositive ? "+" : "-"}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
      isPositive,
      totalMinutes: totalBalanceMinutes,
    };
  };

  const markEntry = async () => {
    if (!user) return;
    
    const today = new Date().toISOString().split("T")[0];
    const currentTime = getCurrentTime();

    try {
      // Check if record already exists for today
      const { data: existing } = await supabase
        .from("time_records")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();

      if (existing) {
        toast.error("Já existe um registro de entrada para hoje");
        return;
      }

      const { error } = await supabase
        .from("time_records")
        .insert({
          user_id: user.id,
          employee_name: employeeName,
          date: today,
          entry_time: currentTime,
          lunch_exit_time: null,
          lunch_return_time: null,
          exit_time: null,
          total_hours: null,
        });

      if (error) throw error;

      toast.success(`Entrada registrada: ${currentTime}`);
      await loadRecords();
    } catch (error: any) {
      console.error("Error marking entry:", error);
      toast.error("Erro ao registrar entrada");
    }
  };

  const markLunchExit = async () => {
    if (!user) return;
    
    const today = new Date().toISOString().split("T")[0];
    const currentTime = getCurrentTime();

    try {
      const { data: existing } = await supabase
        .from("time_records")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();

      if (!existing) {
        toast.error("Você precisa registrar a entrada primeiro");
        return;
      }

      if (existing.lunch_exit_time) {
        toast.error("Saída para almoço já foi registrada");
        return;
      }

      const { error } = await supabase
        .from("time_records")
        .update({ lunch_exit_time: currentTime })
        .eq("id", existing.id);

      if (error) throw error;

      toast.success(`Saída para almoço registrada: ${currentTime}`);
      await loadRecords();
    } catch (error: any) {
      console.error("Error marking lunch exit:", error);
      toast.error("Erro ao registrar saída para almoço");
    }
  };

  const markLunchReturn = async () => {
    if (!user) return;
    
    const today = new Date().toISOString().split("T")[0];
    const currentTime = getCurrentTime();

    try {
      const { data: existing } = await supabase
        .from("time_records")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();

      if (!existing) {
        toast.error("Você precisa registrar a entrada primeiro");
        return;
      }

      if (!existing.lunch_exit_time) {
        toast.error("Você precisa registrar a saída para almoço primeiro");
        return;
      }

      if (existing.lunch_return_time) {
        toast.error("Volta do almoço já foi registrada");
        return;
      }

      const { error } = await supabase
        .from("time_records")
        .update({ lunch_return_time: currentTime })
        .eq("id", existing.id);

      if (error) throw error;

      toast.success(`Volta do almoço registrada: ${currentTime}`);
      await loadRecords();
    } catch (error: any) {
      console.error("Error marking lunch return:", error);
      toast.error("Erro ao registrar volta do almoço");
    }
  };

  const markExit = async () => {
    if (!user) return;
    
    const today = new Date().toISOString().split("T")[0];
    const currentTime = getCurrentTime();

    try {
      const { data: existing } = await supabase
        .from("time_records")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();

      if (!existing) {
        toast.error("Você precisa registrar a entrada primeiro");
        return;
      }

      if (existing.exit_time) {
        toast.error("Saída já foi registrada hoje");
        return;
      }

      const { total, overtime } = calculateTotalHours(
        existing.entry_time, 
        existing.lunch_exit_time,
        existing.lunch_return_time,
        currentTime
      );

      const { error } = await supabase
        .from("time_records")
        .update({
          exit_time: currentTime,
          total_hours: total,
        })
        .eq("id", existing.id);

      if (error) throw error;

      toast.success(`Saída registrada: ${currentTime}`);
      await loadRecords();
    } catch (error: any) {
      console.error("Error marking exit:", error);
      toast.error("Erro ao registrar saída");
    }
  };

  const exportToXLS = (recordsToExport: TimeRecord[], filename: string) => {
    if (recordsToExport.length === 0) {
      toast.error("Nenhum registro para exportar");
      return;
    }

    const data = recordsToExport.map((r) => ({
      Data: new Date(r.date + "T00:00:00").toLocaleDateString("pt-BR"),
      Funcionário: r.employee_name,
      Entrada: r.entry_time || "--:--",
      "Saída Almoço": r.lunch_exit_time || "--:--",
      "Volta Almoço": r.lunch_return_time || "--:--",
      Saída: r.exit_time || "--:--",
      "Total Horas": r.total_hours || "--:--",
    }));

    const balance = calculateBalance(recordsToExport);
    
    // Add balance row
    data.push({
      Data: "",
      Funcionário: "",
      Entrada: "",
      "Saída Almoço": "",
      "Volta Almoço": "",
      Saída: "Saldo Total:",
      "Total Horas": balance.formatted,
    });
    
    // Add empty row
    data.push({
      Data: "",
      Funcionário: "",
      Entrada: "",
      "Saída Almoço": "",
      "Volta Almoço": "",
      Saída: "",
      "Total Horas": "",
    });
    
    // Add signature row
    data.push({
      Data: "Assinatura do funcionário: ________________________________",
      Funcionário: "",
      Entrada: "",
      "Saída Almoço": "",
      "Volta Almoço": "",
      Saída: "",
      "Total Horas": "",
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Registros");
    
    XLSX.writeFile(workbook, filename);
    toast.success("Excel exportado com sucesso!");
  };

  const exportCurrentMonth = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDay = new Date(year, month, 1).toISOString().split("T")[0];
    const lastDay = new Date(year, month + 1, 0).toISOString().split("T")[0];

    const monthRecords = records.filter((r) => r.date >= firstDay && r.date <= lastDay);

    if (monthRecords.length === 0) {
      toast.error("Nenhum registro encontrado para o mês atual");
      return;
    }

    const monthName = today.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    exportToXLS(monthRecords, `registros-ponto-${monthName}.xlsx`);
  };

  const openPeriodDialog = () => {
    setPeriodStartDate("");
    setPeriodEndDate("");
    setPeriodDialogOpen(true);
  };

  const exportPeriod = () => {
    if (!periodStartDate || !periodEndDate) {
      toast.error("Selecione as datas inicial e final");
      return;
    }

    if (periodStartDate > periodEndDate) {
      toast.error("Data inicial não pode ser maior que a data final");
      return;
    }

    const periodRecords = records.filter(
      (r) => r.date >= periodStartDate && r.date <= periodEndDate
    );

    if (periodRecords.length === 0) {
      toast.error("Nenhum registro encontrado para o período selecionado");
      return;
    }

    exportToXLS(periodRecords, `registros-ponto-${periodStartDate}_${periodEndDate}.xlsx`);
    setPeriodDialogOpen(false);
  };

  const openClearDialog = () => {
    setClearDialogOpen(true);
    setClearPassword("");
  };

  const clearAllData = async () => {
    if (clearPassword !== "3255") {
      toast.error("Senha incorreta");
      return;
    }

    if (!user) return;

    try {
      const { error } = await supabase
        .from("time_records")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Todos os dados foram limpos");
      setClearDialogOpen(false);
      setClearPassword("");
      await loadRecords();
    } catch (error: any) {
      console.error("Error clearing data:", error);
      toast.error("Erro ao limpar dados");
    }
  };

  const openEditDialog = (record: TimeRecord) => {
    setEditingRecord(record);
    setEditFormData({
      entry_time: record.entry_time || "",
      lunch_exit_time: record.lunch_exit_time || "",
      lunch_return_time: record.lunch_return_time || "",
      exit_time: record.exit_time || "",
    });
    setEditPassword("");
    setEditDialogOpen(true);
  };

  const saveEditedRecord = async () => {
    if (editPassword !== "3255") {
      toast.error("Senha incorreta");
      return;
    }

    if (!editingRecord) return;

    try {
      const { total, overtime } = calculateTotalHours(
        editFormData.entry_time || null,
        editFormData.lunch_exit_time || null,
        editFormData.lunch_return_time || null,
        editFormData.exit_time || null
      );

      const { error } = await supabase
        .from("time_records")
        .update({
          entry_time: editFormData.entry_time || null,
          lunch_exit_time: editFormData.lunch_exit_time || null,
          lunch_return_time: editFormData.lunch_return_time || null,
          exit_time: editFormData.exit_time || null,
          total_hours: total,
        })
        .eq("id", editingRecord.id);

      if (error) throw error;

      setEditDialogOpen(false);
      setEditingRecord(null);
      setEditPassword("");
      toast.success("Registro atualizado com sucesso!");
      await loadRecords();
    } catch (error: any) {
      console.error("Error updating record:", error);
      toast.error("Erro ao atualizar registro");
    }
  };

  const openDeleteDialog = (record: TimeRecord) => {
    setRecordToDelete(record);
    setDeletePassword("");
    setDeleteDialogOpen(true);
  };

  const deleteRecord = async () => {
    if (deletePassword !== "3255") {
      toast.error("Senha incorreta. Ação cancelada.");
      return;
    }

    if (!recordToDelete) return;

    try {
      const { error } = await supabase
        .from("time_records")
        .delete()
        .eq("id", recordToDelete.id);

      if (error) throw error;

      setDeleteDialogOpen(false);
      setRecordToDelete(null);
      setDeletePassword("");
      toast.success("Registro apagado com sucesso!");
      await loadRecords();
    } catch (error: any) {
      console.error("Error deleting record:", error);
      toast.error("Erro ao apagar registro");
    }
  };

  const openManualEntryDialog = () => {
    setManualEntryData({
      date: new Date().toISOString().split("T")[0],
      entry_time: "",
      lunch_exit_time: "",
      lunch_return_time: "",
      exit_time: "",
    });
    setManualEntryDialogOpen(true);
  };

  const saveManualEntry = async () => {
    if (!user || !manualEntryData.date) {
      toast.error("Data é obrigatória");
      return;
    }

    if (!manualEntryData.entry_time && !manualEntryData.exit_time) {
      toast.error("Preencha pelo menos a entrada ou saída");
      return;
    }

    try {
      const { total } = calculateTotalHours(
        manualEntryData.entry_time || null,
        manualEntryData.lunch_exit_time || null,
        manualEntryData.lunch_return_time || null,
        manualEntryData.exit_time || null
      );

      const { error } = await supabase
        .from("time_records")
        .insert({
          user_id: user.id,
          employee_name: employeeName,
          date: manualEntryData.date,
          entry_time: manualEntryData.entry_time || null,
          lunch_exit_time: manualEntryData.lunch_exit_time || null,
          lunch_return_time: manualEntryData.lunch_return_time || null,
          exit_time: manualEntryData.exit_time || null,
          total_hours: total,
        });

      if (error) throw error;

      toast.success("Registro manual adicionado com sucesso!");
      setManualEntryDialogOpen(false);
      await loadRecords();
    } catch (error: any) {
      console.error("Error saving manual entry:", error);
      toast.error("Erro ao salvar registro manual");
    }
  };

  // Filter records by month instead of specific date
  const getMonthRecords = () => {
    if (!filterDate) return records;
    
    const selectedDate = new Date(filterDate + "T00:00:00");
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1).toISOString().split("T")[0];
    const lastDay = new Date(year, month + 1, 0).toISOString().split("T")[0];
    
    return records
      .filter((r) => r.date >= firstDay && r.date <= lastDay)
      .sort((a, b) => a.date.localeCompare(b.date)); // Sort chronologically
  };

  const filteredRecords = getMonthRecords();

  const currentDate = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const selectedMonthName = filterDate 
    ? new Date(filterDate + "T00:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    : "Todos os registros";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center justify-center gap-4 flex-1">
              <img src={logoCvc} alt="CVC Logo" className="w-24 h-24 object-contain" />
            </div>
            <div className="flex gap-2">
              {role === "admin" && (
                <Button onClick={() => navigate("/admin")} variant="default" size="sm">
                  <Shield className="w-4 h-4 mr-2" />
                  Painel Admin
                </Button>
              )}
              <Button onClick={handleLogout} variant="outline" size="sm">
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-foreground flex items-center justify-center gap-3">
            <Clock className="w-10 h-10 text-accent" />
            Sistema de Controle de Ponto
          </h1>
          <p className="text-muted-foreground capitalize">{currentDate}</p>
          <p className="text-lg font-semibold">Olá, {employeeName}!</p>
        </div>

        {/* Time Marking */}
        <Card className="p-6 shadow-lg">
          <h2 className="text-2xl font-semibold mb-4">Marcação de Ponto</h2>
          <div className="flex flex-wrap gap-3 justify-center mb-4">
            <Button
              onClick={markEntry}
              className="bg-success hover:bg-success/90"
            >
              Registrar Entrada
            </Button>
            <Button
              onClick={markLunchExit}
              className="bg-warning hover:bg-warning/90"
            >
              Saída Almoço
            </Button>
            <Button
              onClick={markLunchReturn}
              className="bg-info hover:bg-info/90"
            >
              Volta Almoço
            </Button>
            <Button
              onClick={markExit}
              className="bg-destructive hover:bg-destructive/90"
            >
              Registrar Saída
            </Button>
          </div>
          <div className="border-t pt-4 mt-4">
            <Button
              onClick={openManualEntryDialog}
              variant="outline"
              className="w-full"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Adicionar Registro Manual (Qualquer Data)
            </Button>
          </div>
        </Card>

        {/* Records Table */}
        <Card className="p-6 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-2xl font-semibold">Registros de Ponto</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Visualizando: {selectedMonthName}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <Input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-auto"
                  title="Selecione qualquer dia para ver o mês inteiro"
                />
              </div>
              <Button onClick={exportCurrentMonth} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Exportar Mês Atual
              </Button>
              <Button onClick={openPeriodDialog} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Exportar Período
              </Button>
              <Button
                onClick={openClearDialog}
                variant="outline"
                size="sm"
                className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Limpar Tudo
              </Button>
            </div>
          </div>

          {filteredRecords.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum registro encontrado para este mês
            </p>
          ) : (
            <>
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto border border-border rounded-md">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted">
                      <th className="text-left p-3 font-semibold">Data</th>
                      <th className="text-left p-3 font-semibold">Entrada</th>
                      <th className="text-left p-3 font-semibold">Saída Almoço</th>
                      <th className="text-left p-3 font-semibold">Volta Almoço</th>
                      <th className="text-left p-3 font-semibold">Saída</th>
                      <th className="text-left p-3 font-semibold">Total Horas</th>
                      <th className="text-left p-3 font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((record) => {
                      const { total, overtime } = calculateTotalHours(
                        record.entry_time,
                        record.lunch_exit_time,
                        record.lunch_return_time,
                        record.exit_time
                      );
                      return (
                        <tr key={record.id} className="border-b border-border hover:bg-muted/50">
                          <td className="p-3">
                            {new Date(record.date + "T00:00:00").toLocaleDateString("pt-BR")}
                          </td>
                          <td className="p-3">{record.entry_time || "--:--"}</td>
                          <td className="p-3">{record.lunch_exit_time || "--:--"}</td>
                          <td className="p-3">{record.lunch_return_time || "--:--"}</td>
                          <td className="p-3">{record.exit_time || "--:--"}</td>
                          <td className="p-3">
                            <span
                              className={`font-semibold ${
                                overtime
                                  ? "text-overtime"
                                  : "text-success"
                              }`}
                            >
                              {total}
                              {overtime && " ⚠️"}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex gap-2">
                              <Button
                                onClick={() => openEditDialog(record)}
                                size="sm"
                                variant="outline"
                                className="border-info text-info hover:bg-info hover:text-info-foreground"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                onClick={() => openDeleteDialog(record)}
                                size="sm"
                                variant="outline"
                                className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Registro</DialogTitle>
              <DialogDescription>
                Data: {editingRecord?.date && new Date(editingRecord.date + "T00:00:00").toLocaleDateString("pt-BR")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-entry">Entrada</Label>
                <Input
                  id="edit-entry"
                  type="time"
                  value={editFormData.entry_time}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, entry_time: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-lunch-exit">Saída Almoço</Label>
                <Input
                  id="edit-lunch-exit"
                  type="time"
                  value={editFormData.lunch_exit_time}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, lunch_exit_time: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-lunch-return">Volta Almoço</Label>
                <Input
                  id="edit-lunch-return"
                  type="time"
                  value={editFormData.lunch_return_time}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, lunch_return_time: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-exit">Saída</Label>
                <Input
                  id="edit-exit"
                  type="time"
                  value={editFormData.exit_time}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, exit_time: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-password">Senha</Label>
                <Input
                  id="edit-password"
                  type="password"
                  placeholder="Digite a senha"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={saveEditedRecord} className="bg-success hover:bg-success/90">
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Period Export Dialog */}
        <Dialog open={periodDialogOpen} onOpenChange={setPeriodDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Exportar Período</DialogTitle>
              <DialogDescription>
                Selecione a data inicial e final para exportar os registros
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="period-start">Data Inicial</Label>
                <Input
                  id="period-start"
                  type="date"
                  value={periodStartDate}
                  onChange={(e) => setPeriodStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="period-end">Data Final</Label>
                <Input
                  id="period-end"
                  type="date"
                  value={periodEndDate}
                  onChange={(e) => setPeriodEndDate(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPeriodDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={exportPeriod} className="bg-success hover:bg-success/90">
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Record Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Apagar Registro</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja apagar este registro? Esta ação não pode ser desfeita.
                {recordToDelete && (
                  <div className="mt-2 text-foreground">
                    <p><strong>Data:</strong> {new Date(recordToDelete.date + "T00:00:00").toLocaleDateString("pt-BR")}</p>
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="delete-password">Digite a senha para confirmar</Label>
                <Input
                  id="delete-password"
                  type="password"
                  placeholder="Digite a senha"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && deleteRecord()}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={deleteRecord} variant="destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Apagar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Manual Entry Dialog */}
        <Dialog open={manualEntryDialogOpen} onOpenChange={setManualEntryDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar Registro Manual</DialogTitle>
              <DialogDescription>
                Preencha a data e os horários que deseja registrar. Você pode registrar qualquer dia, inclusive dias anteriores.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="manual-date">Data *</Label>
                <Input
                  id="manual-date"
                  type="date"
                  value={manualEntryData.date}
                  onChange={(e) =>
                    setManualEntryData({ ...manualEntryData, date: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-entry">Entrada</Label>
                <Input
                  id="manual-entry"
                  type="time"
                  value={manualEntryData.entry_time}
                  onChange={(e) =>
                    setManualEntryData({ ...manualEntryData, entry_time: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-lunch-exit">Saída Almoço</Label>
                <Input
                  id="manual-lunch-exit"
                  type="time"
                  value={manualEntryData.lunch_exit_time}
                  onChange={(e) =>
                    setManualEntryData({ ...manualEntryData, lunch_exit_time: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-lunch-return">Volta Almoço</Label>
                <Input
                  id="manual-lunch-return"
                  type="time"
                  value={manualEntryData.lunch_return_time}
                  onChange={(e) =>
                    setManualEntryData({ ...manualEntryData, lunch_return_time: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-exit">Saída</Label>
                <Input
                  id="manual-exit"
                  type="time"
                  value={manualEntryData.exit_time}
                  onChange={(e) =>
                    setManualEntryData({ ...manualEntryData, exit_time: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setManualEntryDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={saveManualEntry} className="bg-success hover:bg-success/90">
                Salvar Registro
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Clear Data Dialog */}
        <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Limpar Todos os Dados</DialogTitle>
              <DialogDescription>
                Atenção! Esta ação irá apagar permanentemente todos os seus registros de ponto.
                Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="clear-password">Digite a senha para confirmar</Label>
                <Input
                  id="clear-password"
                  type="password"
                  placeholder="Digite a senha"
                  value={clearPassword}
                  onChange={(e) => setClearPassword(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && clearAllData()}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setClearDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={clearAllData} variant="destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Limpar Tudo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Index;
