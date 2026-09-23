import EmployeeOfTheWeekReport from "@/components/admin/tasks/reports/EmployeeOfTheWeekReport";
import { getEmployeeRanking } from "@/lib/reports/employeeRanking";

export default async function EmployeeOfTheWeekPage() {
  const employees = await getEmployeeRanking(7, 0);
  const lastWeekEmployees = await getEmployeeRanking(7, 7);
  
  return <EmployeeOfTheWeekReport employees={employees} lastWeekEmployees={lastWeekEmployees} />;
}
