Add-Type -ReferencedAssemblies "System.Drawing" @"
using System;
using System.Runtime.InteropServices;
using System.Threading;
using System.Drawing;
using System.Drawing.Imaging;

public class DesktopCapture {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenWindowStation(string name, bool inherit, uint access);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetProcessWindowStation(IntPtr hWinSta);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenDesktop(string name, uint flags, bool inherit, uint access);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr GetDC(IntPtr hwnd);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern int ReleaseDC(IntPtr hwnd, IntPtr hdc);

    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);

    [DllImport("gdi32.dll", SetLastError = true)]
    public static extern IntPtr CreateCompatibleDC(IntPtr hdc);

    [DllImport("gdi32.dll", SetLastError = true)]
    public static extern IntPtr CreateCompatibleBitmap(IntPtr hdc, int nWidth, int nHeight);

    [DllImport("gdi32.dll", SetLastError = true)]
    public static extern IntPtr SelectObject(IntPtr hdc, IntPtr hgdiobj);

    [DllImport("gdi32.dll", SetLastError = true)]
    public static extern bool DeleteDC(IntPtr hdc);

    [DllImport("gdi32.dll", SetLastError = true)]
    public static extern bool DeleteObject(IntPtr hObject);

    [DllImport("gdi32.dll", SetLastError = true)]
    public static extern bool BitBlt(IntPtr hdcDest, int nXDest, int nYDest, int nWidth, int nHeight, IntPtr hdcSrc, int nXSrc, int nYSrc, uint dwRop);

    public static bool TryCapture(string outPath) {
        bool success = false;
        Thread t = new Thread(() => {
            IntPtr winsta = OpenWindowStation("WinSta0", false, 0x0000037F);
            if (winsta != IntPtr.Zero) {
                SetProcessWindowStation(winsta);
            }
            IntPtr desk = OpenDesktop("Default", 0, false, 0x000001FF);
            if (desk != IntPtr.Zero) {
                bool okDesk = SetThreadDesktop(desk);
                Console.WriteLine("SetThreadDesktop on fresh thread: " + okDesk);
            }

            int w = GetSystemMetrics(0); // SM_CXSCREEN
            int h = GetSystemMetrics(1); // SM_CYSCREEN
            Console.WriteLine("Metrics w=" + w + " h=" + h);

            IntPtr hdcScreen = GetDC(IntPtr.Zero);
            Console.WriteLine("hdcScreen=" + hdcScreen);
            if (hdcScreen == IntPtr.Zero) return;

            IntPtr hdcMem = CreateCompatibleDC(hdcScreen);
            IntPtr hbmp = CreateCompatibleBitmap(hdcScreen, w, h);
            IntPtr oldBmp = SelectObject(hdcMem, hbmp);

            bool blt = BitBlt(hdcMem, 0, 0, w, h, hdcScreen, 0, 0, 0x00CC0020 | 0x40000000); // SRCCOPY | CAPTUREBLT
            Console.WriteLine("BitBlt=" + blt + " lastError=" + Marshal.GetLastWin32Error());

            if (!blt) {
                blt = BitBlt(hdcMem, 0, 0, w, h, hdcScreen, 0, 0, 0x00CC0020);
                Console.WriteLine("BitBlt fallback=" + blt + " lastError=" + Marshal.GetLastWin32Error());
            }

            if (blt) {
                using (Bitmap bmp = Image.FromHbitmap(hbmp)) {
                    bmp.Save(outPath, ImageFormat.Jpeg);
                    Console.WriteLine("SAVED REAL DESKTOP SCREENSHOT TO " + outPath);
                    success = true;
                }
            }

            SelectObject(hdcMem, oldBmp);
            DeleteObject(hbmp);
            DeleteDC(hdcMem);
            ReleaseDC(IntPtr.Zero, hdcScreen);
        });

        t.SetApartmentState(ApartmentState.STA);
        t.Start();
        t.Join();
        return success;
    }
}
"@

[DesktopCapture]::TryCapture("F:\TrackingDashboard\scripts\thread_screen.jpg")
