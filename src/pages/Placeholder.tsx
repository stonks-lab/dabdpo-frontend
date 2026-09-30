import PageHeader from '../components/PageHeader'

export default function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <PageHeader title={title} subtitle="Próximamente" />
      <div className="p-8 text-center text-gray-400 text-sm">
        Esta sección se habilitará cuando estén disponibles los datos de fuentes adicionales
        (SharePoint, ODBC P&C, SQL Server).
      </div>
    </div>
  )
}
