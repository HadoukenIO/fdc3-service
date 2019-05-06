namespace OpenFin.FDC3.Client.Payloads
{
    public class RaiseIntentPayload : PayloadBase
    {
        public string Intent { get; set; }
        public string Target { get; set; }
    }
}