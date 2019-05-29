using System;

namespace OpenFin.FDC3.Exceptions
{
    public class OpenFinInitializationException : Exception
    {
        public OpenFinInitializationException(string message) : base(message)
        {
        }
    }
}