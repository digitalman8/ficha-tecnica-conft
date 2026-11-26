using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

static class Instalador
{
    const string Nome = "Fichas Técnicas";
    const string Executavel = Nome + ".exe";
    const string Recurso = "FichasTecnicas.Pacote";

    [STAThread]
    static int Main(string[] args)
    {
        if (args.Length == 2 && args[0] == "--verificar-pacote")
        {
            try
            {
                Extrair(args[1]);
                return 0;
            }
            catch (Exception erro)
            {
                File.WriteAllText(args[1] + ".erro.txt", erro.ToString());
                return 1;
            }
        }

        Application.EnableVisualStyles();
        using (var mutex = new Mutex(false, @"Local\FichasTecnicas-Instalador"))
        {
            try
            {
                if (!mutex.WaitOne(0))
                    throw new InvalidOperationException("Já existe outra instalação em andamento.");
            }
            catch (AbandonedMutexException)
            {
                // A instalação anterior foi interrompida. O destino será verificado novamente.
            }
            catch (Exception erro)
            {
                MessageBox.Show(erro.Message, Nome, MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return 1;
            }

            try
            {
                if (MessageBox.Show("Instalar ou atualizar Fichas Técnicas neste computador?",
                    Nome, MessageBoxButtons.OKCancel, MessageBoxIcon.Question) != DialogResult.OK)
                    return 0;

                Cursor.Current = Cursors.WaitCursor;
                string caminho = Instalar();
                Cursor.Current = Cursors.Default;
                if (MessageBox.Show("Instalação concluída. Deseja abrir Fichas Técnicas?",
                    Nome, MessageBoxButtons.YesNo, MessageBoxIcon.Information) == DialogResult.Yes)
                    Process.Start(new ProcessStartInfo(caminho) { WorkingDirectory = Path.GetDirectoryName(caminho) });
                return 0;
            }
            catch (Exception erro)
            {
                MessageBox.Show(erro.Message, "Instalação de " + Nome, MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
            }
            finally
            {
                Cursor.Current = Cursors.Default;
                mutex.ReleaseMutex();
            }
        }
    }

    static string Instalar()
    {
        string programas = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs");
        string destino = Path.Combine(programas, Nome);
        string executavel = Path.Combine(destino, Executavel);
        string anterior = destino + ".anterior";
        string temporario = destino + ".instalando-" + Guid.NewGuid().ToString("N");

        if (Directory.Exists(anterior) && !File.Exists(Path.Combine(anterior, Executavel)))
            throw new IOException("Já existe uma pasta diferente no local reservado para a atualização.");
        if (Directory.Exists(anterior) && !Directory.Exists(destino))
            Directory.Move(anterior, destino);
        if (Directory.Exists(destino) && !File.Exists(executavel))
            throw new IOException("Já existe uma pasta diferente no local de instalação.");
        if (Directory.Exists(anterior))
            Limpar(anterior);

        int sessao;
        using (Process atual = Process.GetCurrentProcess())
            sessao = atual.SessionId;
        foreach (Process processo in Process.GetProcessesByName(Nome))
        {
            using (processo)
            {
                if (processo.SessionId == sessao)
                    throw new IOException("Feche Fichas Técnicas antes de atualizar e abra o instalador novamente.");
            }
        }

        try
        {
            Extrair(temporario);
            if (Directory.Exists(destino))
                Directory.Move(destino, anterior);
            try
            {
                Directory.Move(temporario, destino);
            }
            catch
            {
                if (Directory.Exists(anterior) && !Directory.Exists(destino))
                    Directory.Move(anterior, destino);
                throw;
            }
            Limpar(anterior);
            CriarAtalho(Environment.SpecialFolder.Programs, executavel);
            CriarAtalho(Environment.SpecialFolder.DesktopDirectory, executavel);
            return executavel;
        }
        finally
        {
            Limpar(temporario);
        }
    }

    static void Extrair(string destino)
    {
        if (Directory.Exists(destino))
            throw new IOException("A pasta de extração já existe.");
        Directory.CreateDirectory(destino);
        using (Stream pacote = Assembly.GetExecutingAssembly().GetManifestResourceStream(Recurso))
        using (var arquivo = new ZipArchive(pacote, ZipArchiveMode.Read))
            arquivo.ExtractToDirectory(destino);
        if (!File.Exists(Path.Combine(destino, Executavel)) ||
            !File.Exists(Path.Combine(destino, "resources", "app.asar")))
            throw new IOException("O pacote de instalação está incompleto.");
    }

    static void CriarAtalho(Environment.SpecialFolder pasta, string executavel)
    {
        string destino = Path.Combine(Environment.GetFolderPath(pasta), Nome + ".lnk");
        dynamic shell = Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
        dynamic atalho = shell.CreateShortcut(destino);
        try
        {
            atalho.TargetPath = executavel;
            atalho.WorkingDirectory = Path.GetDirectoryName(executavel);
            atalho.IconLocation = executavel + ",0";
            atalho.Description = "Fichas técnicas de confeitaria";
            atalho.Save();
        }
        finally
        {
            Marshal.FinalReleaseComObject(atalho);
            Marshal.FinalReleaseComObject(shell);
        }
    }

    static void Limpar(string caminho)
    {
        try { if (Directory.Exists(caminho)) Directory.Delete(caminho, true); }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }
}
