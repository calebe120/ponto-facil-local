import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Clock, Users, Download, Trash2, Calendar } from "lucide-react";

interface TimeRecord {
  id: string;
  employeeName: string;
  date: string;
  entrada?: string;
  saidaAlmoco?: string;
  retornoAlmoco?: string;
  saida?: string;
  totalHoras?: string;
  horasExtras?: boolean;
}

const Index = () => {
  const [employees, setEmployees] = useState<string[]>([]);
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [filterDate, setFilterDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // Load data from localStorage
  useEffect(() => {
    const savedEmployees = localStorage.getItem("employees");
    const savedRecords = localStorage.getItem("timeRecords");
    if (savedEmployees) setEmployees(JSON.parse(savedEmployees));
    if (savedRecords) setRecords(JSON.parse(savedRecords));
  }, []);

  // Save employees to localStorage
  useEffect(() => {
    localStorage.setItem("employees", JSON.stringify(employees));
  }, [employees]);

  // Save records to localStorage
  useEffect(() => {
    localStorage.setItem("timeRecords", JSON.stringify(records));
  }, [records]);

  const addEmployee = () => {
    if (!newEmployeeName.trim()) {
      toast.error("Digite o nome do funcionário");
      return;
    }
    if (employees.includes(newEmployeeName.trim())) {
      toast.error("Funcionário já cadastrado");
      return;
    }
    setEmployees([...employees, newEmployeeName.trim()]);
    setNewEmployeeName("");
    toast.success("Funcionário adicionado com sucesso!");
  };

  const removeEmployee = (name: string) => {
    setEmployees(employees.filter((e) => e !== name));
    toast.success("Funcionário removido");
  };

  const getCurrentTime = () => {
    const now = new Date();
    return now.toTimeString().slice(0, 5);
  };

  const calculateTotalHours = (record: TimeRecord): { total: string; overtime: boolean } => {
    if (!record.entrada || !record.saida) {
      return { total: "--:--", overtime: false };
    }

    const timeToMinutes = (time: string) => {
      const [h, m] = time.split(":").map(Number);
      return h * 60 + m;
    };

    const entrada = timeToMinutes(record.entrada);
    const saida = timeToMinutes(record.saida);
    
    let totalMinutes = saida - entrada;
    
    // Subtract lunch break (1 hour = 60 minutes)
    if (record.saidaAlmoco && record.retornoAlmoco) {
      const saidaAlmoco = timeToMinutes(record.saidaAlmoco);
      const retornoAlmoco = timeToMinutes(record.retornoAlmoco);
      const lunchMinutes = retornoAlmoco - saidaAlmoco;
      totalMinutes -= lunchMinutes;
    } else {
      totalMinutes -= 60; // Default 1 hour lunch
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    const overtime = totalMinutes > 480; // 8 hours = 480 minutes

    return {
      total: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
      overtime,
    };
  };

  const markTime = (employeeName: string, type: "entrada" | "saidaAlmoco" | "retornoAlmoco" | "saida") => {
    const today = new Date().toISOString().split("T")[0];
    const currentTime = getCurrentTime();
    
    const existingRecordIndex = records.findIndex(
      (r) => r.employeeName === employeeName && r.date === today
    );

    let updatedRecords = [...records];

    if (existingRecordIndex >= 0) {
      updatedRecords[existingRecordIndex] = {
        ...updatedRecords[existingRecordIndex],
        [type]: currentTime,
      };
    } else {
      const newRecord: TimeRecord = {
        id: `${employeeName}-${today}-${Date.now()}`,
        employeeName,
        date: today,
        [type]: currentTime,
      };
      updatedRecords = [newRecord, ...updatedRecords];
    }

    // Calculate total hours
    const record = updatedRecords[existingRecordIndex >= 0 ? existingRecordIndex : 0];
    const { total, overtime } = calculateTotalHours(record);
    record.totalHoras = total;
    record.horasExtras = overtime;

    setRecords(updatedRecords);
    
    const typeLabels = {
      entrada: "Entrada",
      saidaAlmoco: "Saída para Almoço",
      retornoAlmoco: "Retorno do Almoço",
      saida: "Saída",
    };
    
    toast.success(`${typeLabels[type]} registrada: ${currentTime}`);
  };

  const exportToCSV = () => {
    const filteredRecords = filterDate
      ? records.filter((r) => r.date === filterDate)
      : records;

    if (filteredRecords.length === 0) {
      toast.error("Nenhum registro para exportar");
      return;
    }

    const headers = ["Data", "Funcionário", "Entrada", "Saída Almoço", "Retorno Almoço", "Saída", "Total Horas"];
    const csvContent = [
      headers.join(","),
      ...filteredRecords.map((r) =>
        [
          r.date,
          r.employeeName,
          r.entrada || "--:--",
          r.saidaAlmoco || "--:--",
          r.retornoAlmoco || "--:--",
          r.saida || "--:--",
          r.totalHoras || "--:--",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `registros-ponto-${filterDate || "todos"}.csv`);
    link.click();
    toast.success("CSV exportado com sucesso!");
  };

  const clearAllData = () => {
    if (window.confirm("Tem certeza que deseja limpar TODOS os dados? Esta ação não pode ser desfeita.")) {
      setEmployees([]);
      setRecords([]);
      localStorage.removeItem("employees");
      localStorage.removeItem("timeRecords");
      toast.success("Todos os dados foram limpos");
    }
  };

  const filteredRecords = filterDate
    ? records.filter((r) => r.date === filterDate)
    : records;

  const currentDate = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-foreground flex items-center justify-center gap-3">
            <Clock className="w-10 h-10 text-accent" />
            Sistema de Controle de Ponto
          </h1>
          <p className="text-muted-foreground capitalize">{currentDate}</p>
        </div>

        {/* Employee Registration */}
        <Card className="p-6 shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Users className="w-6 h-6 text-success" />
            Cadastro de Funcionários
          </h2>
          <div className="flex gap-3">
            <Input
              type="text"
              placeholder="Digite o nome do funcionário"
              value={newEmployeeName}
              onChange={(e) => setNewEmployeeName(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && addEmployee()}
              className="flex-1"
            />
            <Button onClick={addEmployee} className="bg-success hover:bg-success/90">
              Adicionar
            </Button>
          </div>
        </Card>

        {/* Time Marking */}
        {employees.length > 0 && (
          <Card className="p-6 shadow-lg">
            <h2 className="text-2xl font-semibold mb-4">Marcação de Ponto</h2>
            <div className="space-y-4">
              {employees.map((emp) => (
                <div
                  key={emp}
                  className="flex flex-wrap items-center gap-3 p-4 bg-muted rounded-lg"
                >
                  <span className="font-medium text-foreground flex-1 min-w-[150px]">
                    {emp}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => markTime(emp, "entrada")}
                      size="sm"
                      className="bg-success hover:bg-success/90"
                    >
                      Entrada
                    </Button>
                    <Button
                      onClick={() => markTime(emp, "saidaAlmoco")}
                      size="sm"
                      className="bg-warning hover:bg-warning/90"
                    >
                      Saída Almoço
                    </Button>
                    <Button
                      onClick={() => markTime(emp, "retornoAlmoco")}
                      size="sm"
                      className="bg-info hover:bg-info/90"
                    >
                      Retorno Almoço
                    </Button>
                    <Button
                      onClick={() => markTime(emp, "saida")}
                      size="sm"
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Saída
                    </Button>
                    <Button
                      onClick={() => removeEmployee(emp)}
                      size="sm"
                      variant="outline"
                      className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Records Table */}
        <Card className="p-6 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="text-2xl font-semibold">Registros de Ponto</h2>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <Input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-auto"
                />
              </div>
              <Button onClick={exportToCSV} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Exportar CSV
              </Button>
              <Button
                onClick={clearAllData}
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
              Nenhum registro encontrado para esta data
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 font-semibold">Data</th>
                    <th className="text-left p-3 font-semibold">Funcionário</th>
                    <th className="text-left p-3 font-semibold">Entrada</th>
                    <th className="text-left p-3 font-semibold">Saída Almoço</th>
                    <th className="text-left p-3 font-semibold">Retorno</th>
                    <th className="text-left p-3 font-semibold">Saída</th>
                    <th className="text-left p-3 font-semibold">Total Horas</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => (
                    <tr key={record.id} className="border-b border-border hover:bg-muted/50">
                      <td className="p-3">
                        {new Date(record.date + "T00:00:00").toLocaleDateString("pt-BR")}
                      </td>
                      <td className="p-3 font-medium">{record.employeeName}</td>
                      <td className="p-3">{record.entrada || "--:--"}</td>
                      <td className="p-3">{record.saidaAlmoco || "--:--"}</td>
                      <td className="p-3">{record.retornoAlmoco || "--:--"}</td>
                      <td className="p-3">{record.saida || "--:--"}</td>
                      <td className="p-3">
                        <span
                          className={`font-semibold ${
                            record.horasExtras
                              ? "text-overtime"
                              : "text-success"
                          }`}
                        >
                          {record.totalHoras || "--:--"}
                          {record.horasExtras && " ⚠️"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Index;
