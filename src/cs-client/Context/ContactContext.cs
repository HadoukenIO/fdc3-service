using OpenFin.FDC3.Client.Constants;

namespace OpenFin.FDC3.Client.Context
{
    public class ContactContext : ContextBase
    {
        public override string Type => ContextTypes.Contact;        
        public new Contact Id { get; set; }
    }
}