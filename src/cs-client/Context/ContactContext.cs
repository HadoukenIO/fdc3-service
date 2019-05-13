using OpenFin.FDC3.Constants;

namespace OpenFin.FDC3.Context
{
    public class ContactContext : ContextBase
    {
        public override string Type => ContextTypes.Contact;        
        public new Contact Id { get; set; }
    }
}