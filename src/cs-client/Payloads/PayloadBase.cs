using OpenFin.FDC3.Client.Context;

namespace OpenFin.FDC3.Client.Payloads
{
    public abstract class PayloadBase
    {
        public ContextBase Context { get; set; }
    }
}