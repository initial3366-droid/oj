using System;
using System.Reflection;
using System.Runtime.InteropServices;

public static class QojCsharpLauncher
{
    [DllImport("libc")]
    private static extern void _exit(int status);

    public static void Main(string[] args)
    {
        int exitCode = 1;
        if (args.Length != 1)
        {
            _exit(1);
        }

        try
        {
            MethodInfo entryPoint = Assembly.LoadFrom(args[0]).EntryPoint;
            if (entryPoint == null)
            {
                throw new InvalidOperationException("C# entry point was not found");
            }

            object[] invokeArgs = entryPoint.GetParameters().Length == 0
                ? null
                : new object[] { new string[0] };
            object result = entryPoint.Invoke(null, invokeArgs);
            exitCode = result is int ? (int)result : 0;
        }
        catch (TargetInvocationException exception)
        {
            Console.Error.WriteLine(exception.InnerException ?? exception);
        }
        catch (Exception exception)
        {
            Console.Error.WriteLine(exception);
        }

        Console.Out.Flush();
        Console.Error.Flush();
        _exit(exitCode);
    }
}
