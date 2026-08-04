using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.IO;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;

namespace KlyroSetup
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new SetupForm());
        }
    }

    public class SetupForm : Form
    {
        const int W = 560;
        const int H = 360;
        const int BARS = 26;

        float scale = 1f;
        Image bg;
        System.Windows.Forms.Timer anim;
        Random rng = new Random();
        float[] barH = new float[BARS];
        float[] barT = new float[BARS];
        int tick = 0;
        double progress = 0.0;
        double target = 0.9;
        volatile bool done = false;
        volatile bool failed = false;
        string status = "Preparando\u2026";
        bool fadingOut = false;
        float fade = 0f;
        RectangleF closeRect;
        bool closeHover = false;

        Font statusFont = new Font("Segoe UI", 9.5f);
        Font pctFont = new Font("Segoe UI", 9.5f, FontStyle.Bold);

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        static extern bool ReleaseCapture();
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        static extern IntPtr SendMessage(IntPtr hWnd, int msg, int wParam, int lParam);

        public SetupForm()
        {
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen;
            Text = "KlyroSC Setup";
            DoubleBuffered = true;
            BackColor = Color.FromArgb(7, 6, 8);
            Opacity = 0;
            using (Graphics g = CreateGraphics()) scale = g.DpiX / 96f;
            ClientSize = new Size((int)(W * scale), (int)(H * scale));
            Region = new Region(RoundPath(new RectangleF(0, 0, ClientSize.Width, ClientSize.Height), S(16)));
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
            bg = LoadImage("bg.png");
            closeRect = new RectangleF(S(W - 42), S(14), S(28), S(28));
            for (int i = 0; i < BARS; i++) { barH[i] = S(5); barT[i] = S(8 + rng.Next(34)); }
            anim = new System.Windows.Forms.Timer();
            anim.Interval = 30;
            anim.Tick += OnTick;
            anim.Start();
            Shown += OnShown;
            MouseDown += OnMouseDownDrag;
            MouseMove += OnMouseMoveHover;
            MouseClick += OnMouseClickClose;
        }

        float S(float v) { return v * scale; }

        static Image LoadImage(string name)
        {
            Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream(name);
            return s == null ? null : Image.FromStream(s);
        }

        static GraphicsPath RoundPath(RectangleF r, float radius)
        {
            GraphicsPath p = new GraphicsPath();
            float d = radius * 2f;
            p.AddArc(r.X, r.Y, d, d, 180, 90);
            p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
            p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
            p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
            p.CloseFigure();
            return p;
        }

        void OnShown(object sender, EventArgs e)
        {
            Thread t = new Thread(InstallWork);
            t.IsBackground = true;
            t.Start();
        }

        void SetStatus(string text)
        {
            try { BeginInvoke((Action)delegate { status = text; }); } catch { }
        }

        void InstallWork()
        {
            try
            {
                SetStatus("Preparando os arquivos\u2026");
                string payload = Path.Combine(Path.GetTempPath(), "KlyroSC-Update-payload.exe");
                using (Stream src = Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.exe"))
                {
                    if (src == null) throw new Exception("pacote de instala\u00e7\u00e3o ausente");
                    using (FileStream dst = File.Create(payload)) { src.CopyTo(dst); }
                }
                SetStatus("Baixando...\u2026");
                ProcessStartInfo psi = new ProcessStartInfo(payload, "/S");
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                Process p = Process.Start(psi);
                p.WaitForExit();
                try { File.Delete(payload); } catch { }
                if (p.ExitCode != 0) throw new Exception("o instalador retornou o c\u00f3digo " + p.ExitCode);

                string exe = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "Programs\\KlyroSC\\KlyroSC.exe");
                if (!File.Exists(exe)) throw new Exception("aplicativo n\u00e3o encontrado ap\u00f3s a instala\u00e7\u00e3o");

                SetStatus("Instalado :p\u2026");
                target = 1.0;
                done = true;
                Thread.Sleep(1100);
                Process.Start(new ProcessStartInfo(exe) { UseShellExecute = true });
                Thread.Sleep(500);
                BeginInvoke((Action)delegate { fadingOut = true; });
            }
            catch (Exception ex)
            {
                failed = true;
                try
                {
                    BeginInvoke((Action)delegate
                    {
                        anim.Stop();
                        Opacity = 1;
                        MessageBox.Show(this,
                            "N\u00e3o foi poss\u00edvel instalar o KlyroSC.\n\n" + ex.Message,
                            "KlyroSC Setup", MessageBoxButtons.OK, MessageBoxIcon.Error);
                        Close();
                    });
                }
                catch { }
            }
        }

        void OnTick(object sender, EventArgs e)
        {
            tick++;
            if (fadingOut)
            {
                fade -= 0.07f;
                if (fade <= 0f) { Close(); return; }
            }
            else if (fade < 1f)
            {
                fade = Math.Min(1f, fade + 0.08f);
            }
            Opacity = fade;

            progress += (target - progress) * (done ? 0.09 : 0.010);

            if (tick % 5 == 0)
            {
                int changes = 3 + rng.Next(4);
                for (int c = 0; c < changes; c++)
                {
                    int i = rng.Next(BARS);
                    barT[i] = S(6 + rng.Next(56));
                }
            }
            for (int i = 0; i < BARS; i++) barH[i] += (barT[i] - barH[i]) * 0.16f;

            Invalidate();
        }

        void OnMouseDownDrag(object sender, MouseEventArgs e)
        {
            if (e.Button == MouseButtons.Left && !closeRect.Contains(e.Location))
            {
                ReleaseCapture();
                SendMessage(Handle, 0xA1, 0x2, 0);
            }
        }

        void OnMouseMoveHover(object sender, MouseEventArgs e)
        {
            bool hover = closeRect.Contains(e.Location);
            if (hover != closeHover) { closeHover = hover; Invalidate(); }
        }

        void OnMouseClickClose(object sender, MouseEventArgs e)
        {
            if (!closeRect.Contains(e.Location)) return;
            if (done || failed) { fadingOut = true; return; }
            DialogResult r = MessageBox.Show(this,
                "A instala\u00e7\u00e3o ainda est\u00e1 em andamento. Sair mesmo assim?",
                "KlyroSC Setup", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
            if (r == DialogResult.Yes) Environment.Exit(0);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

            if (bg != null) g.DrawImage(bg, new Rectangle(0, 0, ClientSize.Width, ClientSize.Height));
            else using (SolidBrush b = new SolidBrush(BackColor)) g.FillRectangle(b, ClientRectangle);

            DrawBars(g);
            DrawProgress(g);
            DrawClose(g);

            using (GraphicsPath border = RoundPath(new RectangleF(0.5f, 0.5f, ClientSize.Width - 1f, ClientSize.Height - 1f), S(16)))
            using (Pen pen = new Pen(Color.FromArgb(110, 179, 20, 35), 1.4f))
                g.DrawPath(pen, border);
        }

        void DrawBars(Graphics g)
        {
            float left = S(56);
            float right = ClientSize.Width - S(56);
            float baseY = S(268);
            float slot = (right - left) / BARS;
            float bw = Math.Max(2f, slot - S(3.5f));
            float energy = 0.45f + 0.55f * (float)progress;
            for (int i = 0; i < BARS; i++)
            {
                float h = Math.Max(S(3), barH[i] * energy);
                RectangleF r = new RectangleF(left + i * slot, baseY - h, bw, h);
                int alphaTop = 200 - (int)(120f * i / BARS);
                using (LinearGradientBrush b = new LinearGradientBrush(
                    new RectangleF(r.X, r.Y - 1, r.Width, r.Height + 2),
                    Color.FromArgb(alphaTop, 229, 72, 77),
                    Color.FromArgb(50, 122, 14, 24),
                    LinearGradientMode.Vertical))
                {
                    g.FillRectangle(b, r);
                }
            }
        }

        void DrawProgress(Graphics g)
        {
            float x = S(56);
            float width = ClientSize.Width - S(112);
            float y = S(306);
            float h = S(5);

            using (GraphicsPath track = RoundPath(new RectangleF(x, y, width, h), h / 2f))
            using (SolidBrush tb = new SolidBrush(Color.FromArgb(28, 22, 25)))
                g.FillPath(tb, track);

            float fw = (float)(width * progress);
            if (fw > h)
            {
                RectangleF fill = new RectangleF(x, y, fw, h);
                using (GraphicsPath fp = RoundPath(fill, h / 2f))
                using (LinearGradientBrush fb = new LinearGradientBrush(fill,
                    Color.FromArgb(122, 14, 24), Color.FromArgb(229, 72, 77), LinearGradientMode.Horizontal))
                    g.FillPath(fb, fp);

                float pulse = 0.5f + 0.5f * (float)Math.Sin(tick * 0.12);
                using (GraphicsPath fp = RoundPath(fill, h / 2f))
                using (Pen glow = new Pen(Color.FromArgb((int)(40 + 50 * pulse), 229, 72, 77), 3f))
                    g.DrawPath(glow, fp);
            }

            using (SolidBrush sb = new SolidBrush(Color.FromArgb(151, 145, 140)))
                g.DrawString(status, statusFont, sb, x - S(2), y + S(14));

            string pct = ((int)Math.Round(progress * 100)) + "%";
            SizeF ps = g.MeasureString(pct, pctFont);
            using (SolidBrush pb = new SolidBrush(Color.FromArgb(229, 72, 77)))
                g.DrawString(pct, pctFont, pb, x + width - ps.Width + S(4), y + S(14));
        }

        void DrawClose(Graphics g)
        {
            if (closeHover)
                using (SolidBrush hb = new SolidBrush(Color.FromArgb(46, 229, 72, 77)))
                    g.FillEllipse(hb, closeRect);
            using (Pen pen = new Pen(closeHover ? Color.FromArgb(240, 232, 228) : Color.FromArgb(120, 151, 145, 140), 1.6f))
            {
                float cx = closeRect.X + closeRect.Width / 2f;
                float cy = closeRect.Y + closeRect.Height / 2f;
                float k = S(5);
                g.DrawLine(pen, cx - k, cy - k, cx + k, cy + k);
                g.DrawLine(pen, cx + k, cy - k, cx - k, cy + k);
            }
        }
    }
}
