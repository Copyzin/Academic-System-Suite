import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-border">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <FileQuestion className="w-8 h-8" />
        </div>
        <h1 className="font-display text-2xl font-bold mb-2">Pagina nao encontrada</h1>
        <p className="text-muted-foreground mb-6">A rota solicitada nao existe ou foi movida.</p>
        <Link href="/">
          <Button className="w-full">Voltar para o inicio</Button>
        </Link>
      </div>
    </div>
  );
}
