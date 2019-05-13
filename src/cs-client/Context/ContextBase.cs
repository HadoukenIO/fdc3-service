using System.Collections.Generic;
using System.Reflection;
using System.Linq;

namespace OpenFin.FDC3.Context
{
    public abstract class ContextBase
    {
        private static Dictionary<string, List<PropertyInfo>> properties;
        public virtual string Type { get; }
        public string Name { get; set; }
        public Dictionary<string, string> Id { get; set; }
        private static Dictionary<string, object> customProps { get; set; }
        public object this[string propertyName]
        {
            get { return customProps[propertyName]; }
            set
            {
                if (properties == null)
                {
                    properties = new Dictionary<string, List<PropertyInfo>>();
                }

                if (!properties.ContainsKey(this.GetType().Name))
                {
                    properties[this.GetType().Name] = this.GetType().GetProperties().ToList();
                }


                var props = properties[this.GetType().Name];
                var prop = props.FirstOrDefault(x => x.Name == propertyName);

                if (prop != null)
                {
                    prop.SetValue(this, value);
                }
                else
                {
                    customProps[propertyName] = value;
                }
            }
        }
    }
}